const dotenv = require("dotenv");

dotenv.config({ path: "./config/config.env" });

const express = require("express");
const cors = require("cors");
const path = require("path");
const db = require("./config/Connection");
const userRoute = require("./route/userRoute/userRoute");
const pageRoute = require("./route/pageRoute/pageRoute");
const roleRoute = require("./route/roleRoute/roleRoute");
const profileRoute = require("./route/profileRoute/profileRoute");
const documentRoute = require("./route/documentRoute/documentRoute");
const meetingRoute = require("./route/meetingRoute/meetingRoute");
const visaRoute = require("./route/visaRoute/visaRoute");
const supportSystemRoute = require("./route/supportSystemRoute/supportSystemRoute");
const aiRoute = require("./route/aiRoute/aiRoute");
const serviceTemplateRoute = require("./route/serviceTemplateRoute/serviceTemplateRoute");
const ticketBookingRoute = require("./route/ticketBookingRoute/ticketBookingRoute");
const app = express();

const allowedOrigins = [
  "https://visaconsultancy.research-hero.com",
  "https://visabackend.research-hero.com",
  "https://forestgreen-gaur-811230.hostingersite.com",
  "http://localhost:5173",
  "http://localhost:4000",
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true); 
    } else {
      callback(new Error("Not allowed by CORS")); 
    }
  },
  methods: "GET,HEAD,PUT,PATCH,POST,DELETE",
  credentials: true,
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use("/uploads", express.static(path.join(__dirname, "uploads")));


app.get("/", (req, res) => {
  res.send("Node.js project is running");
});



app.use("/api/v1/user", userRoute);
app.use("/api/v1/pages", pageRoute);
app.use("/api/v1/roles", roleRoute);
app.use("/api/v1/profile", profileRoute);
app.use("/api/v1/documents", documentRoute);
app.use("/api/v1/meetings", meetingRoute);
app.use("/api/v1/visa", visaRoute);
app.use("/api/v1/support", supportSystemRoute);
app.use("/api/v1/ai", aiRoute);
app.use("/api/v1/service-templates", serviceTemplateRoute);
app.use("/api/v1/ticket-bookings", ticketBookingRoute);




const PORT = process.env.PORT;
app.listen(PORT, async() => {
  console.log(`Server running on port ${PORT}`);

  try {
    await db.getConnection();
    console.log("MySQL Database connected successfully");
  
  } catch (error) {
    console.log(error);
  }




});
