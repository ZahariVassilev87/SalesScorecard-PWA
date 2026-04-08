/**
 * Phase 1B — auth handlers (moved from server.js; HTTP status and JSON bodies unchanged).
 */

function buildLoginResponse(deps, user) {
  const { jwt, JWT_SECRET, REFRESH_SECRET, DEFAULT_COMPANY_ID } = deps;
  const token = jwt.sign(
    {
      id: user.id,
      email: user.email,
      role: user.role,
      displayName: user.displayName,
      companyId: user.companyId || DEFAULT_COMPANY_ID,
    },
    JWT_SECRET,
    { expiresIn: '24h' }
  );
  const refreshToken = jwt.sign(
    {
      id: user.id,
      email: user.email,
      companyId: user.companyId || DEFAULT_COMPANY_ID,
    },
    REFRESH_SECRET,
    { expiresIn: '7d' }
  );
  return {
    token,
    refreshToken,
    user: {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      isActive: user.isActive,
      companyId: user.companyId || DEFAULT_COMPANY_ID,
    },
  };
}

function createAuthHandlers(deps) {
  const { pool, jwt, JWT_SECRET, REFRESH_SECRET, DEFAULT_COMPANY_ID } = deps;

  async function login(req, res) {
    const { email, password } = req.body;
    console.log('Login attempt:', { email, password: '***' });

    const bcrypt = require('bcrypt');

    try {
      const result = await pool.query(
        'SELECT id, email, password, role, "displayName", "isActive", "companyId" FROM users WHERE email = $1 AND "isActive" = true',
        [email]
      );

      if (result.rows.length === 0) {
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'Unauthorized',
          statusCode: 401,
        });
      }

      const user = result.rows[0];

      const isPasswordValid = await bcrypt.compare(password, user.password);

      if (!isPasswordValid) {
        return res.status(401).json({
          message: 'Invalid email or password',
          error: 'Unauthorized',
          statusCode: 401,
        });
      }

      console.log('Login successful for user:', user.email);
      return res.json(buildLoginResponse(deps, user));
    } catch (error) {
      console.error('Database error during login:', error);
      const payload = {
        message: 'Internal server error',
        error: 'DatabaseError',
        statusCode: 500,
        hint:
          'Usually: PostgreSQL not running, DATABASE_URL wrong, or DB not migrated/seeded. See DEV-ENVIRONMENT.md and ./start-dev.sh --seed.',
      };
      if (process.env.NODE_ENV === 'development') {
        payload.details = error && error.message ? String(error.message) : String(error);
      }
      res.status(500).json(payload);
    }
  }

  function refresh(req, res) {
    const { refreshToken } = req.body;
    console.log('Refresh token request');

    if (!refreshToken) {
      return res.status(401).json({ message: 'No refresh token provided' });
    }

    jwt.verify(refreshToken, REFRESH_SECRET, async (err, tokenPayload) => {
      if (err) {
        return res.status(403).json({ message: 'Invalid refresh token' });
      }

      const issueRefresh = (user) => {
        const payload = {
          id: user.id,
          email: user.email,
          role: user.role,
          displayName: user.displayName,
          companyId: user.companyId || DEFAULT_COMPANY_ID,
        };
        const newToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '24h' });
        const newRefreshToken = jwt.sign(
          { id: user.id, email: user.email, companyId: user.companyId || DEFAULT_COMPANY_ID },
          REFRESH_SECRET,
          { expiresIn: '7d' }
        );
        res.json({ token: newToken, refreshToken: newRefreshToken });
      };

      try {
        const result = await pool.query(
          'SELECT id, email, role, "displayName", "companyId" FROM users WHERE id = $1 AND "isActive" = true',
          [tokenPayload.id]
        );

        if (result.rows.length > 0) {
          return issueRefresh(result.rows[0]);
        }

        return res.status(401).json({ message: 'User not found or inactive' });
      } catch (dbError) {
        console.error('Error refreshing token:', dbError);
        res.status(500).json({ message: 'Failed to refresh token' });
      }
    });
  }

  function logout(req, res) {
    console.log('Logout request');
    res.json({ message: 'Logged out successfully' });
  }

  return { login, refresh, logout };
}

module.exports = { createAuthHandlers };
