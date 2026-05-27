export const transformOperation = (baseText, op) => {
  if (!op || typeof op.position !== "number") return baseText;
  const safePos = Math.max(0, Math.min(op.position, baseText.length));

  if (op.type === "insert") {
    return `${baseText.slice(0, safePos)}${op.content || ""}${baseText.slice(safePos)}`;
  }

  if (op.type === "delete") {
    const count = Math.max(0, Number(op.length || 0));
    return `${baseText.slice(0, safePos)}${baseText.slice(safePos + count)}`;
  }

  return baseText;
};
