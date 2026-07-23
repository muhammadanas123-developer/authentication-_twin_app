require("dotenv").config();

const express = require("express");
const cors = require("cors");
const nodemailer = require("nodemailer");
const admin = require("firebase-admin");

const app = express();

app.use(cors());
app.use(express.json());

// Firebase Admin from Render ENV
admin.initializeApp({
  credential: admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, "\n"),
  }),
});

const db = admin.firestore();

// Gmail
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_EMAIL,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
});

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// SEND OTP
app.post("/send-otp", async (req, res) => {
  try {
    const { email } = req.body;

    const otp = generateOTP();

    await db.collection("otps").doc(email).set({
      code: otp,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    await transporter.sendMail({
      from: process.env.GMAIL_EMAIL,
      to: email,
      subject: "OTP Verification",
      text: `Your OTP is ${otp}. Valid for 5 minutes.`,
    });

    res.json({
      success: true,
      message: "OTP sent successfully",
    });

  } catch (e) {
    console.error(e);

    res.status(500).json({
      success: false,
      message: e.message,
    });
  }
});

// VERIFY OTP
app.post("/verify-otp", async (req, res) => {
  try {
    const { email, otp } = req.body;

    const doc = await db.collection("otps").doc(email).get();

    if (!doc.exists) {
      return res.json({
        success: false,
      });
    }

    const data = doc.data();

    const createdAt = data.createdAt.toDate();

    const diff =
        (Date.now() - createdAt.getTime()) / 1000 / 60;

    if (diff > 5) {
      return res.json({
        success: false,
      });
    }

    if (data.code !== otp) {
      return res.json({
        success: false,
      });
    }

    await db.collection("otps").doc(email).delete();

    return res.json({
      success: true,
    });

  } catch (e) {
    console.error(e);

    return res.status(500).json({
      success: false,
    });
  }
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
