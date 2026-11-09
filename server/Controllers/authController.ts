import { Router, Request, Response } from "express";
import prisma from "../model/db";
import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendEmail } from "../src/Otp";

const router = Router();

// Makes a random 6 digit code like "483920"
function makeOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// We save only a hash of the code, never the code itself
function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

// POST /api/signup
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { username, email, password } = req.body;

    // Only check that the fields exist (the frontend checks the rest)
    if (!username || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Check if the email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // 2. Hash the password and make the code
    const hashedPassword = await bcrypt.hash(String(password), 12);
    const otp = makeOtp();

    // 3. Save the user and the code
    const user = await prisma.user.create({
      data: {
        name: String(username).trim(),
        email: cleanEmail,
        password: hashedPassword,
        otp: {
          create: {
            otp: hashOtp(otp),
            expiresAt: new Date(Date.now() + 10 * 60 * 1000), // 10 minutes
          },
        },
      },
    });

   try {
    
    await sendEmail(
      cleanEmail,
      "Your Verification Code",
      `Your OTP is ${otp}. It will expire in 10 minutes.`,
      `<p>Your OTP is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
    );

    console.log(`Generated OTP for ${email}: ${otp}`);
   } catch (mailError) {
     console.error("Email failed:", mailError);
     await prisma.user.delete({ where: { id: user.id } }); // otp rows go too (Cascade)
     return res.status(502).json({
       success: false,
       message: "Could not send the verification email. Please try again.",
     });
   }

    // 4. Send the email. If it fails, delete the user so they can try again

    console.log("user data saved in the db");
    return res.status(201).json({
      success: true,
      message: "Account created. A 6-digit code was sent to your email.",
    });
  } catch (error: any) {
    console.error("Signup error:", error);

    // Two signups with the same email at the same time
    if (error.code === "P2002") {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // Database is down or unreachable
    if (
      error.code === "P1001" ||
      error.name === "PrismaClientInitializationError"
    ) {
      return res.status(503).json({
        success: false,
        message: "Server is down right now. Please try again later.",
      });
    }

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

export default router;
