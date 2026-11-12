import { Router, Request, Response } from "express";
import prisma from "../model/db";
import bcrypt from "bcrypt";
import crypto from "crypto";
import jwt from "jsonwebtoken";
import cookieParser from "cookie-parser";
import { sendEmail } from "../src/Otp";
import { Pool } from "pg";

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
        message: " email and password are required",
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
        message: "invalid email or password",
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
      return res.status(500).json({
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

// ---------- Token settings ----------
const ACCESS_TTL_SECONDS = 15 * 60; // access token lives 15 minutes
const REFRESH_TTL_SECONDS = 7 * 24 * 60 * 60; // refresh token lives 7 days
// temporary, we will edit this later

// Hash a token before saving it, so a leaked database can't be used to log in
function hashToken(token: string) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

function makeAccessToken(userId: number, role: string) {
  return jwt.sign({ userId, role }, process.env.JWT_ACCESS_SECRET!, {
    expiresIn: ACCESS_TTL_SECONDS,
  });
}

function makeRefreshToken(userId: number) {
  return jwt.sign({ userId }, process.env.JWT_REFRESH_SECRET!, {
    expiresIn: REFRESH_TTL_SECONDS,
  });
}

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Username, email and password are required",
      });
    }

    const cleaenEmail = String(email).trim().toLocaleLowerCase();
    const emailExist = await prisma.user.findUnique({
      where: { email: cleaenEmail },
    });

    if (!emailExist) {
      return res.status(401).json({
        success: false,
        message: "An account with this email does not   exists",
      });
    }

    const comparePasswords = await bcrypt.compare(
      String(password),
      emailExist.password
    );

    if (!comparePasswords) {
      return res.status(401).json({
        success: false,
        message: "incorrect  email  or password",
      });
    }
    if (emailExist.email_status === "UNVERIFIED") {
      await prisma.otp.deleteMany({
        where: { userId: emailExist.id },
      });
      const otp = makeOtp();
      await prisma.otp.create({
        data: {
          userId: emailExist.id,
          otp: hashOtp(otp), // save the hash, not the real token
          expiresAt: new Date(Date.now() + 10 * 60 * 1000),
        },
      });

      try {
        await sendEmail(
          cleaenEmail,
          "Your  login  Verification Code",
          `Your OTP is ${otp}. It will expire in 10 minutes.`,
          `<p>Your OTP is <strong>${otp}</strong>. It will expire in 10 minutes.</p>`
        );

        return res.status(403).json({
          success: false,
          message: " please verify your email with the otp we sent",
        });
      } catch (mailError) {
        console.error("Email failed:", mailError);

        

        return res.status(502).json({
          success: false,
          message: "Could not send the verification email. Please try again.",
        });
      }
    }

    const New_Role = emailExist.role;
    const role = New_Role;
    const accessToken = makeAccessToken(emailExist.id, role);
    const refreshToken = makeRefreshToken(emailExist.id);

    // 6. Do all database changes together: all succeed or none do
    await prisma.$transaction([
      prisma.user.update({
        where: { id: emailExist.id },
        data: { email_status: "VERIFIED" },
      }),
    ]);
    // temporary, we will edit this later



      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

     await prisma.token.create({
        data: {
          userId: emailExist.id,
          token: refreshToken,
          expiresAt: expiresAt,
        },
      });


      res.cookie("token",accessToken,{
        httpOnly:true,
        secure:true,
        sameSite:"none",
        maxAge:15*60* 1000
      })


      res.cookie("refreshToken",refreshToken,{
        httpOnly:true,
        secure:true,
        sameSite:"none",
        maxAge:7*24*60*60*1000,
      })
      
    //  it need the token verifcations  and save in here
    return res.status(200).json({
      success: true,
      message: "user loged in succefully",
      accessToken,
      refreshToken,
    });
  } catch (mailError) {
    console.error("Email failed:", mailError);
    // await prisma.user.delete({ where: { id: user.id } }); // otp rows go too (Cascade)
    return res.status(502).json({
      success: false,
      message: "server error Please try again.",
    });
  }
});


router.post("/logout", async (req,res)=> {
try {
  const { refreshToken } = req.cookies;
  if (refreshToken) {
    await prisma.token.deleteMany({
      where: { token: refreshToken },
    });

    const cookieOption = {
      httpOnly: true,
      secure: true,
      sameSite: "none" as const,
    };

    res.clearCookie("token", cookieOption);
    res.clearCookie("refreshToken", cookieOption);
  }
  return res
    .status(200)
    .json({ success: true, message: "Logged out successfully" });
} catch (error) {
  console.log(error);
  return res.status(500).json({ success: false, message: "server failed" });
}
})

// POST /api/verify-otp
router.post("/verify/otp", async (req: Request, res: Response) => {
  try {
    const { email, otp } = req.body ?? {};

    if (!email || !otp) {
      return res.status(400).json({
        success: false,
        message: "Email and OTP are required",
      });
    }

    const cleanEmail = String(email).trim().toLowerCase();

    // 1. Find the user
    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
    });

    if (!user) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or code",
      });
    }

    // 2. Already verified, nothing to do
    if (user.email_status === "VERIFIED") {
      return res.status(400).json({
        success: false,
        message: "This email is already verified",
      });
    }

    // 3. Find the newest code that has not expired
    const savedOtp = await prisma.otp.findFirst({
      where: { userId: user.id, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });

    if (!savedOtp) {
      return res.status(400).json({
        success: false,
        message: "The code has expired. Please request a new one.",
      });
    }

    // 4. Compare the hash of what the user typed with the saved hash
    const enteredHash = hashOtp(String(otp).trim());
    const isValid = crypto.timingSafeEqual(
      Buffer.from(enteredHash),
      Buffer.from(savedOtp.otp)
    );

    if (!isValid) {
      return res.status(400).json({
        success: false,
        message: "Invalid email or code",
      });
    }

    // 5. Create the tokens
    const role = user.role;
    const accessToken = makeAccessToken(user.id, role);
    const refreshToken = makeRefreshToken(user.id);

    // 6. Do all database changes together: all succeed or none do
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { email_status: "VERIFIED" },
      }),
      prisma.otp.deleteMany({ where: { userId: user.id } }), // code works only once
      prisma.token.create({
        data: {
          userId: user.id,
          token: hashToken(refreshToken), // save the hash, not the real token
          expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        },
      }),
    ]);

    // 7. Send the response
    return res.status(200).json({
      success: true,
      message: "Email verified successfully",
      user: {
        name: user.name,
      },
      accessToken,
      refreshToken,
    });
  } catch (error) {
    console.error("Verify OTP error:", error);
    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again.",
    });
  }
});

export default router;
