import mongoose from "mongoose";

const taskSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  title: { type: String, required: true },
  inputText: { type: String, required: true },
  operation: {
    type: String,
    enum: ["uppercase", "lowercase", "reverse", "wordcount"],
    required: true,
  },
  status: {
    type: String,
    enum: ["pending", "running", "success", "failed"],
    default: "pending",
  },
  result: String,
  logs: [String],
  createdAt: { type: Date, default: Date.now },
});

taskSchema.index({ userId: 1, createdAt: -1 }); // Indexing strategy

export default mongoose.model("Task", taskSchema);
