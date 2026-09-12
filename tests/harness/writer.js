
const fs = require("fs");
const path = require("path");

function writeFile(relPath, content) {
  const fullPath = path.resolve(__dirname, "..", relPath);
  const dir = path.dirname(fullPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  fs.writeFileSync(fullPath, content.trimStart(), "utf8");
  console.log("Created: " + relPath);
}

module.exports = { writeFile };
