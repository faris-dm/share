import { Router, Request, Response } from "express";
import prisma from "../model/db";
import crypto from "crypto";
import dotenv from "dotenv";
import { sendEmail } from "../src/Otp";
import { Prisma } from "../src/generated/prisma/client";

const router = Router();
// Makes a random 6 digit code like "483920"
function makeOtp() {
  return crypto.randomInt(100000, 1000000).toString();
}

// / We save only a hash of the code, never the code itself
function hashOtp(otp: string) {
  return crypto.createHash("sha256").update(otp).digest("hex");
}

router.post("/signup", async (req: Request, res: Response) => {
  try {
    const { email } = req.body;
    const cleanEmail = String(email).trim().toLowerCase();
    const emailExist = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!emailExist) {
      return res.status(409).json({
        success: false,
        message: "invalid email or password",
      });
    }
    const otp = makeOtp();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now
    const otpHashs = hashOtp(otp);

    try {
      await prisma.otp.deleteMany({
        where: { userId: emailExist.id },
      });

      await prisma.otp.create({
        data: { userId: emailExist.id, otp: otpHashs, expiresAt: expiresAt },
      });

      await sendEmail(
        cleanEmail,
        "Your  email  Verification Code to reset  your password",
        `Your OTP is ${otp}. It will expire in 10 minutes.`,
        `<p>Your OTP is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
      );

      return res.status(200).json({
        success: false,
        message: " please verify your email with the otp we sent",
      });
    } catch (mailError) {
      console.log(
        "failed  to send the otp that reset your password ,try another way"
      );
      return res.status(502).json({
        success: false,
        message: "Could not send the verification email. Please try again.",
      });
    }
  } catch (error) {
    console.log(error);
    return res.status(500).json("server failed");
  }
});

export default router;
