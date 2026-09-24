const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS
    }
});

async function sendOTP(email, otp) {
    await transporter.sendMail({
        from: process.env.EMAIL_USER,
        to: email,
        subject: 'Shoply - Email Verification OTP',

        html: `
            <div style="font-family: Arial, sans-serif;">
                <h2>Shoply Email Verification</h2>

                <p>Your OTP is:</p>

                <h1 style="letter-spacing: 8px;">
                    ${otp}
                </h1>

                <p>This OTP will expire in 5 minutes.</p>

                <p>
                    If you did not create a Shoply account,
                    you can ignore this email.
                </p>
            </div>
        `
    });
}

module.exports = sendOTP;