const express = require("express");
const axios = require("axios");
const port = process.env.PORT || 3000;
const app = express();

app.use((req, res, next) => {
  res.header("Access-Control-Allow-Origin", "*");
  res.header(
    "Access-Control-Allow-Methods",
    "GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS"
  );
  res.header(
    "Access-Control-Allow-Headers",
    "Origin, X-Requested-With, Content-Type, Accept, Authorization"
  );
  next();
});

app.get("/image", async (req, res) => {
  const imageUrl = req.query.url;

  try {
    const response = await axios({
      url: imageUrl,
      method: "GET",
      responseType: "stream",
    });

    res.setHeader("Content-Type", response.headers["content-type"]);

    response.data.pipe(res);
  } catch (error) {
    console.error("Error fetching image:", error);
    res.status(500).send("Error fetching image");
  }
});

app.listen(port, () => {
  console.log("Server is running on port " + port);
});

module.exports = app;
