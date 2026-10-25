const app = require('./app');
const guardLocal = require('./config/guardLocal');

guardLocal();

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Powerbuilding API corriendo en http://localhost:${PORT}`);
});
