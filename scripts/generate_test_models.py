"""
Generate comprehensive ONNX test model pairs for every diff scenario.

Each pair is a (base, target) that exercises a specific diff behavior:
  1. identical        -- zero changes expected
  2. pruning          -- layers removed
  3. fusion           -- Conv+BN fused into single Conv
  4. quantization     -- INT8 quantize/dequantize ops added
  5. shape_change     -- same ops but tensor shapes differ
  6. attr_change      -- same ops but attribute values differ (kernel size, strides)
  7. added_branch     -- skip connection / residual branch added
  8. removed_branch   -- skip connection removed
  9. reordered        -- same nodes in different order
  10. completely_diff  -- entirely different architectures
  11. single_node     -- minimal 1-node models with type change
  12. deep_chain      -- long sequential chain (20+ nodes) with mid-chain edits
"""

import onnx
from onnx import helper, TensorProto
import os

OUT = os.path.join(os.path.dirname(__file__), "..", "test-models")
os.makedirs(OUT, exist_ok=True)


def vi(name, shape):
    return helper.make_tensor_value_info(name, TensorProto.FLOAT, shape)


def save(model, filename):
    path = os.path.join(OUT, filename)
    onnx.save(model, path)
    nodes = len(model.graph.node)
    size = os.path.getsize(path)
    print(f"  {filename:50s} {nodes:3d} nodes  {size:6d} bytes")


def wrap(nodes, name, inp_shape=[1, 3, 224, 224], out_shape=[1, 10]):
    graph = helper.make_graph(nodes, name, [vi("input", inp_shape)], [vi("output", out_shape)])
    model = helper.make_model(graph, opset_imports=[helper.make_opsetid("", 13)])
    model.producer_name = "isotron-test"
    return model


# ---------------------------------------------------------------------------
# 1. IDENTICAL -- no diff at all
# ---------------------------------------------------------------------------
def gen_identical():
    nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["r2"], name="relu2"),
        helper.make_node("GlobalAveragePool", ["r2"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    save(wrap(nodes, "identical"), "01_identical_base.onnx")
    save(wrap(nodes, "identical"), "01_identical_target.onnx")


# ---------------------------------------------------------------------------
# 2. PRUNING -- BatchNorm layers removed
# ---------------------------------------------------------------------------
def gen_pruning():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("BatchNormalization", ["c1", "s1", "b1", "m1", "v1"], ["bn1"], name="bn1"),
        helper.make_node("Relu", ["bn1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("BatchNormalization", ["c2", "s2", "b2", "m2", "v2"], ["bn2"], name="bn2"),
        helper.make_node("Relu", ["bn2"], ["r2"], name="relu2"),
        helper.make_node("GlobalAveragePool", ["r2"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    target_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["r2"], name="relu2"),
        helper.make_node("GlobalAveragePool", ["r2"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    save(wrap(base_nodes, "pruning_base"), "02_pruning_base.onnx")
    save(wrap(target_nodes, "pruning_target"), "02_pruning_target.onnx")


# ---------------------------------------------------------------------------
# 3. FUSION -- Conv+BN+Relu fused into ConvRelu
# ---------------------------------------------------------------------------
def gen_fusion():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1", "b1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("BatchNormalization", ["c1", "s1", "bi1", "m1", "v1"], ["bn1"], name="bn1"),
        helper.make_node("Relu", ["bn1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2", "b2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("BatchNormalization", ["c2", "s2", "bi2", "m2", "v2"], ["bn2"], name="bn2"),
        helper.make_node("Relu", ["bn2"], ["r2"], name="relu2"),
        helper.make_node("GlobalAveragePool", ["r2"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    target_nodes = [
        helper.make_node("FusedConv", ["input", "w1", "b1"], ["r1"], name="conv1_fused",
                         domain="com.microsoft", activation="Relu"),
        helper.make_node("FusedConv", ["r1", "w2", "b2"], ["r2"], name="conv2_fused",
                         domain="com.microsoft", activation="Relu"),
        helper.make_node("GlobalAveragePool", ["r2"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    save(wrap(base_nodes, "fusion_base"), "03_fusion_base.onnx")
    save(wrap(target_nodes, "fusion_target"), "03_fusion_target.onnx")


# ---------------------------------------------------------------------------
# 4. QUANTIZATION -- QuantizeLinear/DequantizeLinear ops added
# ---------------------------------------------------------------------------
def gen_quantization():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["output"], name="relu2"),
    ]
    target_nodes = [
        helper.make_node("QuantizeLinear", ["input", "s0", "z0"], ["q0"], name="quant_input"),
        helper.make_node("QLinearConv", ["q0", "s0", "z0", "qw1", "sw1", "zw1", "so1", "zo1"], ["qc1"],
                         name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["qc1"], ["qr1"], name="relu1"),
        helper.make_node("QLinearConv", ["qr1", "so1", "zo1", "qw2", "sw2", "zw2", "so2", "zo2"], ["qc2"],
                         name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["qc2"], ["qr2"], name="relu2"),
        helper.make_node("DequantizeLinear", ["qr2", "so2", "zo2"], ["output"], name="dequant_output"),
    ]
    save(wrap(base_nodes, "quant_base", out_shape=[1, 3, 224, 224]), "04_quantization_base.onnx")
    save(wrap(target_nodes, "quant_target", out_shape=[1, 3, 224, 224]), "04_quantization_target.onnx")


# ---------------------------------------------------------------------------
# 5. SHAPE CHANGE -- same ops, different tensor shapes (e.g. input resolution change)
# ---------------------------------------------------------------------------
def gen_shape_change():
    nodes_224 = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("GlobalAveragePool", ["r1"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    nodes_112 = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("GlobalAveragePool", ["r1"], ["pool"], name="pool"),
        helper.make_node("Flatten", ["pool"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    save(wrap(nodes_224, "shape_base", [1, 3, 224, 224]), "05_shape_change_base.onnx")
    save(wrap(nodes_112, "shape_target", [1, 3, 112, 112]), "05_shape_change_target.onnx")


# ---------------------------------------------------------------------------
# 6. ATTRIBUTE CHANGE -- same ops but kernel_shape/strides/pads differ
# ---------------------------------------------------------------------------
def gen_attr_change():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1",
                         kernel_shape=[3, 3], pads=[1,1,1,1], strides=[1, 1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2",
                         kernel_shape=[3, 3], pads=[1,1,1,1], strides=[1, 1]),
        helper.make_node("Relu", ["c2"], ["output"], name="relu2"),
    ]
    target_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1",
                         kernel_shape=[5, 5], pads=[2,2,2,2], strides=[2, 2]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2",
                         kernel_shape=[1, 1], pads=[0,0,0,0], strides=[1, 1]),
        helper.make_node("Relu", ["c2"], ["output"], name="relu2"),
    ]
    save(wrap(base_nodes, "attr_base", out_shape=[1, 3, 224, 224]), "06_attr_change_base.onnx")
    save(wrap(target_nodes, "attr_target", out_shape=[1, 3, 224, 224]), "06_attr_change_target.onnx")


# ---------------------------------------------------------------------------
# 7. ADDED BRANCH -- residual/skip connection added
# ---------------------------------------------------------------------------
def gen_added_branch():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["output"], name="relu2"),
    ]
    target_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Add", ["c2", "r1"], ["skip"], name="residual_add"),
        helper.make_node("Relu", ["skip"], ["output"], name="relu2"),
    ]
    save(wrap(base_nodes, "branch_base", out_shape=[1, 3, 224, 224]), "07_added_branch_base.onnx")
    save(wrap(target_nodes, "branch_target", out_shape=[1, 3, 224, 224]), "07_added_branch_target.onnx")


# ---------------------------------------------------------------------------
# 8. REMOVED BRANCH -- skip connection removed (opposite of 7)
# ---------------------------------------------------------------------------
def gen_removed_branch():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Add", ["c2", "r1"], ["skip"], name="residual_add"),
        helper.make_node("Relu", ["skip"], ["output"], name="relu2"),
    ]
    target_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("Conv", ["r1", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["output"], name="relu2"),
    ]
    save(wrap(base_nodes, "rmbranch_base", out_shape=[1, 3, 224, 224]), "08_removed_branch_base.onnx")
    save(wrap(target_nodes, "rmbranch_target", out_shape=[1, 3, 224, 224]), "08_removed_branch_target.onnx")


# ---------------------------------------------------------------------------
# 9. REORDERED -- same nodes, different topological order
# ---------------------------------------------------------------------------
def gen_reordered():
    base_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Conv", ["input", "w2"], ["c2"], name="conv2", kernel_shape=[1, 1]),
        helper.make_node("Add", ["c1", "c2"], ["sum"], name="add"),
        helper.make_node("Relu", ["sum"], ["output"], name="relu"),
    ]
    # same graph but nodes listed in different order (still valid topological order)
    target_nodes = [
        helper.make_node("Conv", ["input", "w2"], ["c2"], name="conv2", kernel_shape=[1, 1]),
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Add", ["c1", "c2"], ["sum"], name="add"),
        helper.make_node("Relu", ["sum"], ["output"], name="relu"),
    ]
    save(wrap(base_nodes, "reorder_base", out_shape=[1, 3, 224, 224]), "09_reordered_base.onnx")
    save(wrap(target_nodes, "reorder_target", out_shape=[1, 3, 224, 224]), "09_reordered_target.onnx")


# ---------------------------------------------------------------------------
# 10. COMPLETELY DIFFERENT -- entirely different architectures
# ---------------------------------------------------------------------------
def gen_completely_diff():
    cnn_nodes = [
        helper.make_node("Conv", ["input", "w1"], ["c1"], name="conv1", kernel_shape=[7, 7], strides=[2, 2], pads=[3,3,3,3]),
        helper.make_node("Relu", ["c1"], ["r1"], name="relu1"),
        helper.make_node("MaxPool", ["r1"], ["mp"], name="maxpool", kernel_shape=[3, 3], strides=[2, 2], pads=[1,1,1,1]),
        helper.make_node("Conv", ["mp", "w2"], ["c2"], name="conv2", kernel_shape=[3, 3], pads=[1,1,1,1]),
        helper.make_node("Relu", ["c2"], ["r2"], name="relu2"),
        helper.make_node("GlobalAveragePool", ["r2"], ["gap"], name="gap"),
        helper.make_node("Flatten", ["gap"], ["flat"], name="flatten", axis=1),
        helper.make_node("Gemm", ["flat", "fw", "fb"], ["output"], name="fc"),
    ]
    mlp_nodes = [
        helper.make_node("Flatten", ["input"], ["flat"], name="flatten", axis=1),
        helper.make_node("MatMul", ["flat", "w1"], ["mm1"], name="linear1"),
        helper.make_node("Relu", ["mm1"], ["r1"], name="relu1"),
        helper.make_node("MatMul", ["r1", "w2"], ["mm2"], name="linear2"),
        helper.make_node("Relu", ["mm2"], ["r2"], name="relu2"),
        helper.make_node("MatMul", ["r2", "w3"], ["output"], name="linear3"),
    ]
    save(wrap(cnn_nodes, "cnn_arch"), "10_completely_diff_base_cnn.onnx")
    save(wrap(mlp_nodes, "mlp_arch"), "10_completely_diff_target_mlp.onnx")


# ---------------------------------------------------------------------------
# 11. SINGLE NODE -- minimal models, type change only
# ---------------------------------------------------------------------------
def gen_single_node():
    base = [helper.make_node("Relu", ["input"], ["output"], name="activation")]
    target = [helper.make_node("Sigmoid", ["input"], ["output"], name="activation")]
    save(wrap(base, "single_relu", [1, 64], [1, 64]), "11_single_node_base_relu.onnx")
    save(wrap(target, "single_sigmoid", [1, 64], [1, 64]), "11_single_node_target_sigmoid.onnx")


# ---------------------------------------------------------------------------
# 12. DEEP CHAIN -- 20-node chain with mid-chain modifications
# ---------------------------------------------------------------------------
def gen_deep_chain():
    base_nodes = []
    target_nodes = []
    prev_base = "input"
    prev_target = "input"

    for i in range(20):
        out_name = f"n{i}" if i < 19 else "output"

        # Base: alternating Conv and Relu
        if i % 2 == 0:
            base_nodes.append(helper.make_node("Conv", [prev_base, f"w{i}"], [out_name],
                              name=f"layer_{i}", kernel_shape=[3, 3], pads=[1,1,1,1]))
        else:
            base_nodes.append(helper.make_node("Relu", [prev_base], [out_name], name=f"layer_{i}"))

        # Target: same but layers 8-11 are replaced with different ops
        if 8 <= i <= 11:
            if i == 8:
                target_nodes.append(helper.make_node("DepthwiseConv", [prev_target, f"dw{i}"], [out_name],
                                    name=f"layer_{i}", kernel_shape=[3, 3], pads=[1,1,1,1]))
            elif i == 9:
                target_nodes.append(helper.make_node("HardSwish", [prev_target], [out_name], name=f"layer_{i}"))
            elif i == 10:
                target_nodes.append(helper.make_node("Conv", [prev_target, f"pw{i}"], [out_name],
                                    name=f"layer_{i}", kernel_shape=[1, 1]))
            elif i == 11:
                target_nodes.append(helper.make_node("Relu6", [prev_target], [out_name], name=f"layer_{i}"))
        elif i % 2 == 0:
            target_nodes.append(helper.make_node("Conv", [prev_target, f"w{i}"], [out_name],
                                name=f"layer_{i}", kernel_shape=[3, 3], pads=[1,1,1,1]))
        else:
            target_nodes.append(helper.make_node("Relu", [prev_target], [out_name], name=f"layer_{i}"))

        prev_base = out_name
        prev_target = out_name

    save(wrap(base_nodes, "deep_base", out_shape=[1, 3, 224, 224]), "12_deep_chain_base.onnx")
    save(wrap(target_nodes, "deep_target", out_shape=[1, 3, 224, 224]), "12_deep_chain_target.onnx")


# ---------------------------------------------------------------------------
if __name__ == "__main__":
    print("Generating comprehensive ONNX test models:\n")

    gen_identical()
    gen_pruning()
    gen_fusion()
    gen_quantization()
    gen_shape_change()
    gen_attr_change()
    gen_added_branch()
    gen_removed_branch()
    gen_reordered()
    gen_completely_diff()
    gen_single_node()
    gen_deep_chain()

    print(f"\nDone. All models saved to: {os.path.abspath(OUT)}")
