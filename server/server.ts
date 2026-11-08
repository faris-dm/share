import express, { Request, Response } from "express";
import dotenv from "dotenv";
import cookies from "cookie-parser"
import cors from "cors"


dotenv.config();
const app = express();
app.use(cookies())
app.use(cors())


app.get("/", (req, res) => {
  console.log("server is running ");
});

const port = process.env.port;

app.listen(port, () => {
  console.log(`http://localhost:${port}`);
});
