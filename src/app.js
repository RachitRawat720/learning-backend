import express, { urlencoded } from "express"
import cors from "cors"
import cookieParser from "cookie-parser";

const app = express();

app.use(cors({
    origin: process.env.CORS_ORIGIN, // * - any website can talk to our API
    credentials: true // tells the browser that our server accepts incoming login details, session cookies, or authorization tokes from the client
}))

app.use(express.json({limit: "16kb"}))  // to control the maximum size of the incoming json

app.use(express.urlencoded({extended: true, limit: "16kb"})) // built in middleware function to parse incoming HTTP POST requests and submitted data from the request body and formats it into a clean JavaScript Object accessible via req.body

app.use(express.static("public")) // to serve static file like images, CSS stylesheets, client side JavaScript files directly to the browser. These are openly accessible via HTTP requests without needing a custom route for every single file

app.use(cookieParser())

// routes import
import userRouter from './routes/routes.js'

//routes declaration
app.use("/api/v1/users", userRouter)

export { app }