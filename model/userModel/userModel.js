const db = require("../../config/Connection");
const crypto = require("crypto");

const registerUser = async (
    first_name,
    last_name,
    email,
    phone,
    hashPassword,
    roleId
  ) => {
    const connection = await db.getConnection();
  
    try {
      await connection.beginTransaction();
  
      // Generate verification token (5 minute expiry)
      const verificationToken = crypto.randomBytes(32).toString("hex");
      const tokenExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

      const userQuery = `
        INSERT INTO users (first_name, last_name, email, phone, password_hash, email_verified, verification_token, token_expiry)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `;
      const userValues = [
        first_name,
        last_name,
        email,
        phone,
        hashPassword,
        false, // email_verified is initially false
        verificationToken,
        tokenExpiry
      ];
  
      const [userResult] = await connection.query(userQuery, userValues);
      const userId = userResult.insertId;
  
      const roleQuery = `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
      `;
      const roleValues = [userId, roleId];
  
      const [roleResult] = await connection.query(roleQuery, roleValues);
  
      await connection.commit();
  
      console.log(`User registered: ${email}, Token: ${verificationToken}, Expiry: ${tokenExpiry}`);

      return {
        userId,
        roleAssigned: roleResult.affectedRows > 0,
        verificationToken,
        email
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

const checkEmailExists = async (email) => {
  const connection = await db.getConnection();

  try {
    const query = `
      SELECT id
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const [rows] = await connection.query(query, [email]);
    return rows.length > 0;
  } finally {
    connection.release();
  }
};

const verifyEmailToken = async (token) => {
  const connection = await db.getConnection();

  try {
    console.log(`[VERIFY] Attempting to verify token: ${token}`);

    // First, try to find user with this exact token
    const query = `
      SELECT id, email, token_expiry, email_verified 
      FROM users 
      WHERE verification_token = ?
    `;

    const [rows] = await connection.query(query, [token]);
    console.log(`[VERIFY] Query result rows: ${rows.length}`);

    if (rows.length > 0) {
      // Token found - proceed with verification
      const user = rows[0];
      console.log(`[VERIFY] User found: ${user.email}, email_verified: ${user.email_verified}, token_expiry: ${user.token_expiry}`);

      // Check if already verified
      if (user.email_verified === 1 || user.email_verified === true) {
        console.log(`[VERIFY] Email already verified for: ${user.email}`);
        throw new Error("Email is already verified");
      }

      // Check if token has expired
      const now = new Date();
      const expiry = new Date(user.token_expiry);
      console.log(`[VERIFY] Current time: ${now}, Token expiry: ${expiry}, Is expired: ${now > expiry}`);

      if (now > expiry) {
        console.log(`[VERIFY] Token expired for: ${user.email}`);
        const expiredError = new Error("Verification token has expired");
        expiredError.email = user.email;
        throw expiredError;
      }

      // Update user to mark email as verified and clear token
      const updateQuery = `
        UPDATE users 
        SET email_verified = 1, verification_token = NULL, token_expiry = NULL 
        WHERE id = ?
      `;

      const [updateResult] = await connection.query(updateQuery, [user.id]);
      console.log(`[VERIFY] Update successful for user id: ${user.id}, affected rows: ${updateResult.affectedRows}`);

      return {
        success: true,
        userId: user.id,
        email: user.email,
        message: "Email verified successfully"
      };
    } else {
      // Token not found in current records
      // Check if this token belongs to an already-verified user by looking up users with null tokens
      console.log(`[VERIFY] Token not found with verification_token = ${token}`);
      console.log(`[VERIFY] Checking if email was already verified...`);
      
      // We can't determine if it was already verified without more info
      // So throw invalid token error
      throw new Error("Invalid verification token");
    }
  } catch (error) {
    console.log(`[VERIFY] Error: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
};

const resendVerificationToken = async (email) => {
  const connection = await db.getConnection();

  try {
    console.log(`[RESEND] Attempting to resend verification for: ${email}`);

    // Check if user exists
    const selectQuery = `SELECT id, email_verified FROM users WHERE email = ?`;
    const [rows] = await connection.query(selectQuery, [email]);

    if (rows.length === 0) {
      console.log(`[RESEND] User not found: ${email}`);
      throw new Error("User not found");
    }

    const user = rows[0];

    // Check if already verified
    if (user.email_verified === 1 || user.email_verified === true) {
      console.log(`[RESEND] Email already verified for: ${email}`);
      throw new Error("Email is already verified");
    }

    const userId = user.id;

    // Generate new verification token
    const verificationToken = crypto.randomBytes(32).toString("hex");
    const tokenExpiry = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes from now

    // Update token and expiry
    const updateQuery = `
      UPDATE users 
      SET verification_token = ?, token_expiry = ? 
      WHERE id = ?
    `;

    await connection.query(updateQuery, [verificationToken, tokenExpiry, userId]);
    console.log(`[RESEND] New token generated for: ${email}, Token: ${verificationToken}`);

    return {
      verificationToken,
      email
    };
  } catch (error) {
    console.log(`[RESEND] Error: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
};


const loginUser = async (email) => {
  const connection = await db.getConnection();

  try {
    console.log(`[LOGIN] Attempting login for: ${email}`);

    const query = `
      SELECT 
        u.id, 
        u.first_name, 
        u.last_name, 
        u.email, 
        u.phone, 
        u.password_hash, 
        u.email_verified, 
        u.status,
        ur.role_id,
        r.name AS role_name
      FROM users AS u
      JOIN user_roles AS ur ON u.id = ur.user_id
      JOIN roles AS r on ur.role_id = r.id
      WHERE email = ?
    `;

    const [rows] = await connection.query(query, [email]);

    if (rows.length === 0) {
      console.log(`[LOGIN] User not found: ${email}`);
      throw new Error("User not found");
    }

    const user = rows[0];

    
    if (!user.email_verified || user.email_verified === 0 || user.email_verified === false) {
      console.log(`[LOGIN] Email not verified for: ${email}`);
      throw new Error("Email not verified");
    }

    
    if (user.status !== "active" && user.status !== 1) {
      console.log(`[LOGIN] Account inactive for: ${email}`);
      throw new Error("Account is inactive");
    }

    console.log(`[LOGIN] User verified and active: ${email}`);
    return user;
  } catch (error) {
    console.log(`[LOGIN] Error: ${error.message}`);
    throw error;
  } finally {
    connection.release();
  }
};

const findUserByEmailForPasswordReset = async (email) => {
  const connection = await db.getConnection();

  try {
    const query = `
      SELECT id, first_name, email, status
      FROM users
      WHERE email = ?
      LIMIT 1
    `;

    const [rows] = await connection.query(query, [email]);

    if (rows.length === 0) {
      throw new Error("User not found");
    }

    const user = rows[0];

    if (user.status !== "active" && user.status !== 1) {
      throw new Error("Account is inactive");
    }

    return user;
  } catch (error) {
    throw error;
  } finally {
    connection.release();
  }
};

const createPasswordResetOtp = async (userId, otpCode, expiresAt) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    await connection.query(
      `DELETE FROM password_reset_otps WHERE user_id = ?`,
      [userId]
    );

    const insertQuery = `
      INSERT INTO password_reset_otps (user_id, otp_code, expires_at)
      VALUES (?, ?, ?)
    `;

    const [result] = await connection.query(insertQuery, [
      userId,
      otpCode,
      expiresAt,
    ]);

    await connection.commit();

    return {
      otpId: result.insertId,
      otpCode,
      expiresAt,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const verifyPasswordResetOtp = async (email, otpCode) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const query = `
      SELECT
        pro.id,
        pro.user_id,
        pro.otp_code,
        pro.expires_at,
        pro.verified_at,
        pro.is_used,
        u.email
      FROM password_reset_otps AS pro
      JOIN users AS u ON u.id = pro.user_id
      WHERE u.email = ? AND pro.otp_code = ?
      ORDER BY pro.id DESC
      LIMIT 1
    `;

    const [rows] = await connection.query(query, [email, otpCode]);

    if (rows.length === 0) {
      throw new Error("Invalid OTP");
    }

    const otpRecord = rows[0];

    if (otpRecord.is_used === 1 || otpRecord.is_used === true) {
      throw new Error("OTP already used");
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      throw new Error("OTP has expired");
    }

    if (!otpRecord.verified_at) {
      await connection.query(
        `UPDATE password_reset_otps SET verified_at = NOW() WHERE id = ?`,
        [otpRecord.id]
      );
    }

    await connection.commit();

    return {
      otpId: otpRecord.id,
      userId: otpRecord.user_id,
      email: otpRecord.email,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const resetPasswordWithVerifiedOtp = async (userId, otpId, hashPassword) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const query = `
      SELECT id, expires_at, verified_at, is_used
      FROM password_reset_otps
      WHERE id = ? AND user_id = ?
      LIMIT 1
    `;

    const [rows] = await connection.query(query, [otpId, userId]);

    if (rows.length === 0) {
      throw new Error("Invalid reset request");
    }

    const otpRecord = rows[0];

    if (!otpRecord.verified_at) {
      throw new Error("OTP not verified");
    }

    if (otpRecord.is_used === 1 || otpRecord.is_used === true) {
      throw new Error("OTP already used");
    }

    if (new Date() > new Date(otpRecord.expires_at)) {
      throw new Error("OTP has expired");
    }

    await connection.query(
      `UPDATE users SET password_hash = ? WHERE id = ?`,
      [hashPassword, userId]
    );

    await connection.query(
      `UPDATE password_reset_otps SET is_used = 1 WHERE id = ?`,
      [otpId]
    );

    await connection.query(
      `DELETE FROM password_reset_otps WHERE user_id = ? AND id <> ?`,
      [userId, otpId]
    );

    await connection.commit();

    return {
      success: true,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};


const createSystemUsers = async(first_name,
  last_name,
  email,
  phone,
  hashPassword,
  email_verified,
  roleId) =>{
    const connection = await db.getConnection();

    try {
      await connection.beginTransaction();

      const userQuery = `
        INSERT INTO users (first_name, last_name, email, phone, password_hash, email_verified)
        VALUES (?, ?, ?, ?, ?, ?)
      `;

      const userValues = [
        first_name,
        last_name,
        email,
        phone,
        hashPassword,
        email_verified,
      ];

      const [userResult] = await connection.query(userQuery, userValues);
      const userId = userResult.insertId;

      const roleQuery = `
        INSERT INTO user_roles (user_id, role_id)
        VALUES (?, ?)
      `;

      await connection.query(roleQuery, [userId, roleId]);
      await connection.commit();

      return {
        userId,
        first_name,
        last_name,
        email,
        phone,
        roleId,
        email_verified,
      };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  };

const getSystemUsers = async () => {
  const connection = await db.getConnection();

  try {
    const query = `
      SELECT
        u.id,
        u.first_name,
        u.last_name,
        u.email,
        u.phone,
        u.status,
        u.email_verified,
        u.created_at,
        ur.role_id,
        r.name AS role_name
      FROM users AS u
      LEFT JOIN user_roles AS ur ON u.id = ur.user_id
      LEFT JOIN roles AS r ON ur.role_id = r.id
      WHERE r.name IS NOT NULL
        AND LOWER(TRIM(r.name)) <> 'applicant'
      ORDER BY u.id DESC
    `;

    const [rows] = await connection.query(query);
    return rows;
  } finally {
    connection.release();
  }
};

const deleteSystemUser = async (userId) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      `SELECT id, email FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (existingUsers.length === 0) {
      throw new Error("User not found");
    }

    await connection.query(`DELETE FROM user_roles WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM password_reset_otps WHERE user_id = ?`, [userId]);
    await connection.query(`DELETE FROM users WHERE id = ?`, [userId]);

    await connection.commit();

    return {
      userId,
      email: existingUsers[0].email,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

const updateSystemUser = async ({
  userId,
  first_name,
  last_name,
  email,
  phone,
  passwordHash,
  roleId,
}) => {
  const connection = await db.getConnection();

  try {
    await connection.beginTransaction();

    const [existingUsers] = await connection.query(
      `SELECT id FROM users WHERE id = ? LIMIT 1`,
      [userId]
    );

    if (existingUsers.length === 0) {
      throw new Error("User not found");
    }

    if (passwordHash) {
      await connection.query(
        `UPDATE users
         SET first_name = ?, last_name = ?, email = ?, phone = ?, password_hash = ?
         WHERE id = ?`,
        [first_name, last_name, email, phone, passwordHash, userId]
      );
    } else {
      await connection.query(
        `UPDATE users
         SET first_name = ?, last_name = ?, email = ?, phone = ?
         WHERE id = ?`,
        [first_name, last_name, email, phone, userId]
      );
    }

    const [existingRoles] = await connection.query(
      `SELECT user_id FROM user_roles WHERE user_id = ? LIMIT 1`,
      [userId]
    );

    if (existingRoles.length > 0) {
      await connection.query(
        `UPDATE user_roles SET role_id = ? WHERE user_id = ?`,
        [roleId, userId]
      );
    } else {
      await connection.query(
        `INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)`,
        [userId, roleId]
      );
    }

    await connection.commit();

    return {
      userId,
      first_name,
      last_name,
      email,
      phone,
      roleId,
    };
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
};

module.exports = {
    checkEmailExists,
    registerUser,
    verifyEmailToken,
    resendVerificationToken,
    loginUser,
    findUserByEmailForPasswordReset,
    createPasswordResetOtp,
    verifyPasswordResetOtp,
    resetPasswordWithVerifiedOtp,
    createSystemUsers,
    getSystemUsers,
    deleteSystemUser,
    updateSystemUser
}
