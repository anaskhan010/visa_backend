const db = require("../../config/Connection");

const getAllPages = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const [pages] = await connection.query(
      "SELECT id, title, slug, status FROM pages WHERE status = 'active' ORDER BY id ASC"
    );
    return res.status(200).json({
      success: true,
      data: pages,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const getRolePermissions = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { roleId } = req.params;
    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required",
      });
    }
    const [rows] = await connection.query(
      "SELECT id, role_id, page_id, can_view, can_add, can_edit, can_delete FROM page_permission WHERE role_id = ?",
      [roleId]
    );
    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const assignPages = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { roleId, pageIds } = req.body;
    if (!roleId || !pageIds) {
      return res.status(400).json({
        success: false,
        message: "Role ID and Page IDs are required",
      });
    }
    await connection.beginTransaction();
    await connection.query("DELETE FROM page_permission WHERE role_id = ?", [roleId]);
    if (pageIds.length > 0) {
      const values = pageIds.map((pageId) => [roleId, pageId, 1, 0, 0, 0]);
      await connection.query(
        "INSERT INTO page_permission (role_id, page_id, can_view, can_add, can_edit, can_delete) VALUES ?",
        [values]
      );
    }
    await connection.commit();
    return res.status(200).json({
      success: true,
      message: "Pages assigned",
    });
  } catch (error) {
    await connection.rollback();
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

const getPagesByRole = async (req, res) => {
  const connection = await db.getConnection();
  try {
    const { roleId } = req.params;
    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required",
      });
    }
    const [rows] = await connection.query(
      "SELECT p.id, p.title, p.slug, p.status, pp.can_view, pp.can_add, pp.can_edit, pp.can_delete FROM page_permission AS pp JOIN pages AS p ON pp.page_id = p.id WHERE pp.role_id = ? AND p.status = 'active'",
      [roleId]
    );
    return res.status(200).json({
      success: true,
      data: rows,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      message: error.message,
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllPages,
  getRolePermissions,
  assignPages,
  getPagesByRole,
};
