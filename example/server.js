const http = require("http");

const PORT = process.env.PORT || 3000;
const value = process.env.TEST_VALUE || "env not set";

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/html; charset=UTF-8" });
  res.end(`<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>test</title></head>
<body>${value}</body>
</html>`);
});

server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
