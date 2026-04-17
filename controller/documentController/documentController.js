const db = require("../../config/Connection");
const path = require("path");
const fs = require("fs");

// Applicant: get own documents
const getMyDocuments = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const [docs] = await connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Applicant: upload own document
const uploadMyDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { doc_name, doc_type } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const file_path = req.file.filename;
    const [result] = await connection.query("INSERT INTO documents (user_id, doc_name, doc_type, file_path) VALUES (?, ?, ?, ?)", [userId, doc_name, doc_type, file_path]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Applicant: delete own document
const deleteMyDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const userId = req.user.userId;
    const { id } = req.params;
    const [rows] = await connection.query("SELECT file_path FROM documents WHERE id = ? AND user_id = ?", [id, userId]);
    if (rows.length > 0) {
      const filePath = path.join(__dirname, "../../uploads", rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await connection.query("DELETE FROM documents WHERE id = ? AND user_id = ?", [id, userId]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Admin: get documents for a specific applicant
const getApplicantDocuments = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const [docs] = await connection.query("SELECT id, doc_name, doc_type, file_path, status, uploaded_at FROM documents WHERE user_id = ? ORDER BY uploaded_at DESC", [userId]);
    return res.status(200).json({ success: true, data: docs });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Admin: upload document for a specific applicant
const adminUploadDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { userId } = req.params;
    const { doc_name, doc_type } = req.body;
    if (!req.file) return res.status(400).json({ success: false, message: "No file uploaded" });
    const file_path = req.file.filename;
    const [result] = await connection.query("INSERT INTO documents (user_id, doc_name, doc_type, file_path) VALUES (?, ?, ?, ?)", [userId, doc_name, doc_type, file_path]);
    return res.status(201).json({ success: true, data: { id: result.insertId } });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Admin: delete any document
const adminDeleteDocument = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const [rows] = await connection.query("SELECT file_path FROM documents WHERE id = ?", [id]);
    if (rows.length > 0) {
      const filePath = path.join(__dirname, "../../uploads", rows[0].file_path);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    await connection.query("DELETE FROM documents WHERE id = ?", [id]);
    return res.status(200).json({ success: true, message: "Deleted" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

// Admin: update document status
const adminUpdateDocStatus = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { id } = req.params;
    const { status } = req.body;
    await connection.query("UPDATE documents SET status = ? WHERE id = ?", [status, id]);
    return res.status(200).json({ success: true, message: "Status updated" });
  } catch (error) {
    return res.status(500).json({ success: false, message: error.message });
  } finally { connection.release(); }
};

module.exports = {
  getMyDocuments, uploadMyDocument, deleteMyDocument,
  getApplicantDocuments, adminUploadDocument, adminDeleteDocument, adminUpdateDocStatus,
};
