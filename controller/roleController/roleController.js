const db = require("../../config/Connection");

// Get all roles
const getAllRoles = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const query = `
      SELECT id, name, status, created_at, updated_at
      FROM roles
      ORDER BY id ASC
    `;

    const [roles] = await connection.query(query);

    return res.status(200).json({
      success: true,
      message: "Roles fetched successfully",
      data: roles
    });
  } catch (error) {
    console.log("[ROLES CONTROLLER] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Get role by ID
const getRoleById = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { roleId } = req.params;

    if (!roleId) {
      return res.status(400).json({
        success: false,
        message: "Role ID is required"
      });
    }

    const query = `
      SELECT id, name, status, created_at, updated_at
      FROM roles
      WHERE id = ?
    `;

    const [roles] = await connection.query(query, [roleId]);

    if (roles.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Role not found"
      });
    }

    return res.status(200).json({
      success: true,
      message: "Role fetched successfully",
      data: roles[0]
    });
  } catch (error) {
    console.log("[ROLES CONTROLLER] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

// Create new role
const createRole = async (req, res) => {
  const connection = await db.getConnection();

  try {
    const { name, status } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        message: "Role name is required"
      });
    }

    const query = `
      INSERT INTO roles (name, status)
      VALUES (?, ?)
    `;

    const [result] = await connection.query(query, [name, status || 'active']);

    return res.status(201).json({
      success: true,
      message: "Role created successfully",
      data: {
        id: result.insertId,
        name,
        status: status || 'active'
      }
    });
  } catch (error) {
    console.log("[ROLES CONTROLLER] Error:", error.message);
    return res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message
    });
  } finally {
    connection.release();
  }
};

module.exports = {
  getAllRoles,
  getRoleById,
  createRole
};
