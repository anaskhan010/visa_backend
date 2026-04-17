const db = require("../../config/Connection");
const { getDocumentCompletion } = require("../../utils/documentRequirements");

const getCompleteProfile = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const [users] = await connection.query("SELECT id, first_name, last_name, email, phone,email_verified, status FROM users WHERE id = ?", [userId]);
    if (users.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    const [passports] = await connection.query("SELECT id, passport_no, issue_date, expiry_date, issue_country, birth_country FROM passports WHERE user_id = ?", [userId]);
    const [educations] = await connection.query("SELECT id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade FROM educations WHERE user_id = ?", [userId]);
    const [familyMembers] = await connection.query("SELECT id, name, relation, dob, country, status FROM family_members WHERE user_id = ?", [userId]);
    const [finances] = await connection.query("SELECT id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source FROM finances WHERE user_id = ?", [userId]);
    const [documents] = await connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
    const documentCompletion = getDocumentCompletion({ documents, educations, finances, familyMembers });
    const totalFields = 6;
    let filled = 0;
    if (users[0].first_name && users[0].phone) filled++;
    if (passports.length > 0) filled++;
    if (educations.length > 0) filled++;
    if (familyMembers.length > 0) filled++;
    if (finances.length > 0) filled++;
    if (documentCompletion.isComplete) filled++;
    return res.status(200).json({
      success: true,
      data: {
        personalInfo: users[0],
        passports,
        educations,
        familyMembers,
        finances,
        documents,
        documentCompletion,
        completion: {
          completedFields: filled,
          totalFields,
          completionPercentage: Math.round((filled / totalFields) * 100),
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const updatePersonalInfo = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { first_name, last_name, phone } = req.body;
    await connection.query("UPDATE users SET first_name = ?, last_name = ?, phone = ? WHERE id = ?", [first_name, last_name, phone, userId]);
    return res.status(200).json({ success: true, message: "Personal info updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const addPassport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { passport_no, issue_date, expiry_date, issue_country, birth_country } = req.body;
    const [result] = await connection.query("INSERT INTO passports (user_id, passport_no, issue_date, expiry_date, issue_country, birth_country) VALUES (?, ?, ?, ?, ?, ?)", [userId, passport_no, issue_date, expiry_date, issue_country, birth_country]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deletePassport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM passports WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const addEducation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { level, degree_name, field_name, institute_name, country, start_year, end_year, grade } = req.body;
    const [result] = await connection.query("INSERT INTO educations (user_id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [userId, level, degree_name, field_name, institute_name, country, start_year, end_year, grade]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deleteEducation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM educations WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const addFamilyMember = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { name, relation, dob, country, status } = req.body;
    const [result] = await connection.query("INSERT INTO family_members (user_id, name, relation, dob, country, status) VALUES (?, ?, ?, ?, ?, ?)", [userId, name, relation, dob, country, status]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deleteFamilyMember = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM family_members WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const addFinance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source } = req.body;
    const [result] = await connection.query("INSERT INTO finances (user_id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source) VALUES (?, ?, ?, ?, ?, ?, ?)", [userId, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const deleteFinance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM finances WHERE id = ? AND user_id = ?", [req.params.id, req.user.userId]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getAllApplicants = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [users] = await connection.query("SELECT u.id, u.first_name, u.last_name, u.email, u.phone, u.status, u.created_at FROM users AS u JOIN user_roles AS ur ON u.id = ur.user_id WHERE ur.role_id = 2 ORDER BY u.created_at DESC");
    return res.status(200).json({ success: true, data: users });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getAdminStats = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [[activeUsersRows], [activeVisasRows]] = await Promise.all([
      connection.query(`
        SELECT COUNT(*) AS total
        FROM users
        WHERE LOWER(CAST(status AS CHAR)) = 'active' OR CAST(status AS CHAR) = '1'
      `),
      connection.query(`
        SELECT COUNT(*) AS total
        FROM visas
        WHERE LOWER(CAST(status AS CHAR)) = 'active' OR CAST(status AS CHAR) = '1'
      `),
    ]);

    return res.status(200).json({
      success: true,
      data: {
        activeUsers: Number(activeUsersRows[0]?.total) || 0,
        totalVisas: Number(activeVisasRows[0]?.total) || 0,
      },
    });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const getApplicantProfile = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const [users] = await connection.query("SELECT id, first_name, last_name, email, phone, status, created_at FROM users WHERE id = ?", [userId]);
    if (users.length === 0) return res.status(404).json({ success: false, message: "User not found" });
    const [passports] = await connection.query("SELECT id, passport_no, issue_date, expiry_date, issue_country, birth_country FROM passports WHERE user_id = ?", [userId]);
    const [educations] = await connection.query("SELECT id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade FROM educations WHERE user_id = ?", [userId]);
    const [familyMembers] = await connection.query("SELECT id, name, relation, dob, country, status FROM family_members WHERE user_id = ?", [userId]);
    const [finances] = await connection.query("SELECT id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source FROM finances WHERE user_id = ?", [userId]);
    const [documents] = await connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
    return res.status(200).json({ success: true, data: { personalInfo: users[0], passports, educations, familyMembers, finances, documents } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminAddPassport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const { passport_no, issue_date, expiry_date, issue_country, birth_country } = req.body;
    const [result] = await connection.query("INSERT INTO passports (user_id, passport_no, issue_date, expiry_date, issue_country, birth_country) VALUES (?, ?, ?, ?, ?, ?)", [userId, passport_no, issue_date, expiry_date, issue_country, birth_country]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminDeletePassport = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM passports WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminAddEducation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const { level, degree_name, field_name, institute_name, country, start_year, end_year, grade } = req.body;
    const [result] = await connection.query("INSERT INTO educations (user_id, level, degree_name, field_name, institute_name, country, start_year, end_year, grade) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)", [userId, level, degree_name, field_name, institute_name, country, start_year, end_year, grade]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminDeleteEducation = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM educations WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminAddFamilyMember = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const { name, relation, dob, country, status } = req.body;
    const [result] = await connection.query("INSERT INTO family_members (user_id, name, relation, dob, country, status) VALUES (?, ?, ?, ?, ?, ?)", [userId, name, relation, dob, country, status]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminDeleteFamilyMember = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM family_members WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminAddFinance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const { bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source } = req.body;
    const [result] = await connection.query("INSERT INTO finances (user_id, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source) VALUES (?, ?, ?, ?, ?, ?, ?)", [userId, bank_amount, income_amount, currency, sponsor_name, sponsor_relation, fund_source]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

const adminDeleteFinance = async (req, res) => {
  const connection = await db.getConnection();
  try {
    await connection.query("DELETE FROM finances WHERE id = ?", [req.params.id]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

module.exports = {
  getCompleteProfile, updatePersonalInfo,
  addPassport, deletePassport, addEducation, deleteEducation,
  addFamilyMember, deleteFamilyMember, addFinance, deleteFinance,
  getAllApplicants, getApplicantProfile, getAdminStats,
  adminAddPassport, adminDeletePassport, adminAddEducation, adminDeleteEducation,
  adminAddFamilyMember, adminDeleteFamilyMember, adminAddFinance, adminDeleteFinance,
};
