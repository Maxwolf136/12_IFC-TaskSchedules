// Helper function to create a TableGroupData object
function createTableGroupData(row, keys) {
  const data = {};
  for (let i = 0; i < keys.length; i++) {
    data[keys[i]] = row[i];
  }
  return { data, children: [] };
}

// Helper function to find a parent node by ID
function findParentNode(root, parentId) {
  if (root.data.ID === parentId) return root;
  if (root.children) {
    for (const child of root.children) {
      const found = findParentNode(child, parentId);
      if (found) return found;
    }
  }
  return null;
}

// Remove empty children arrays
function cleanUpEmptyChildren(node) {
  if (node.children && node.children.length === 0) {
    delete node.children;
  } else if (node.children) {
    for (const child of node.children) {
      cleanUpEmptyChildren(child);
    }
  }
}

export const transformCsv = (rawData, delimiter = ",") => {
  const data = rawData
    .split("\r\n")
    .filter(v => v !== "")
    .map(row => row.split(delimiter))

  const [keys, ...rows] = data

  // Initialize the result as an empty array
  const result = [];

  // Iterate through the raw data
  for (const row of rows) {
    const idParts = row[0].split('.');
    const parentId = idParts.slice(0, -1).join('.');
    const node = createTableGroupData(row, keys);

    if (parentId === '') {
      result.push(node);
    } else {
      let parentFound = false;
      for (const root of result) {
        const parent = findParentNode(root, parentId);
        if (parent) {
          parent.children.push(node);
          parentFound = true;
          break;
        }
      }
      if (!parentFound) {
        result.push(node); // If no parent found, add it to the root (or handle as needed)
      }
    }
  }

  for (const node of result) {
    cleanUpEmptyChildren(node);
  }

  return result;
}
