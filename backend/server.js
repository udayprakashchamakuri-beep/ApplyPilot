require("dotenv").config();

const { createApp } = require("./app");

const PORT = Number(process.env.PORT || 8787);
const app = createApp({ serveStatic: true });

app.listen(PORT, () => {
  console.log(`ApplyPilot backend running at http://localhost:${PORT}`);
});
