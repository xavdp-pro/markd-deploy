from fastapi import APIRouter, HTTPException, Response, Request
from pydantic import BaseModel
from database import db
import bcrypt
import uuid
import random
import jwt
import os
from datetime import datetime, timedelta
from dotenv import load_dotenv
from email_service import send_password_reset_email, send_email, compile_mjml_template

load_dotenv()

# JWT Configuration
SECRET_KEY = os.getenv("SECRET_KEY", "your-secret-key-change-in-production")
ALGORITHM = "HS256"
# Cookie secure flag - only True in production with HTTPS
USE_SECURE_COOKIE = os.getenv("USE_SECURE_COOKIE", "false").lower() == "true"

router = APIRouter(prefix="/api")

class LoginRequest(BaseModel):
    username: str
    password: str

class CreateUserRequest(BaseModel):
    username: str
    email: str
    password: str
    role: str = 'user'

class UpdateUserRequest(BaseModel):
    username: str = None
    email: str = None
    password: str = None
    role: str = None

class ForgotPasswordRequest(BaseModel):
    email: str

class VerifyCodeRequest(BaseModel):
    email: str
    code: str

class ResetPasswordRequest(BaseModel):
    email: str
    code: str
    newPassword: str

class TestEmailRequest(BaseModel):
    email: str

def hash_password(password: str) -> str:
    """Hash password using bcrypt"""
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def verify_password(password: str, hashed: str) -> bool:
    """Verify password against hash"""
    return bcrypt.checkpw(password.encode('utf-8'), hashed.encode('utf-8'))

def validate_password(password: str) -> tuple[bool, str]:
    """Validate password strength"""
    if len(password) < 10:
        return False, "Password must contain at least 10 characters"
    if not any(c.isupper() for c in password):
        return False, "Password must contain at least 1 uppercase letter (A-Z)"
    if not any(c.islower() for c in password):
        return False, "Password must contain at least 1 lowercase letter (a-z)"
    if not any(c.isdigit() for c in password):
        return False, "Password must contain at least 1 digit (0-9)"
    if not any(c in '!@#$%^&*(),.?":{}|<>' for c in password):
        return False, "Password must contain at least 1 symbol"
    return True, ""

def generate_reset_code() -> str:
    """Generate 6-digit reset code"""
    return str(random.randint(100000, 999999))

@router.post("/auth/login")
async def login(request: LoginRequest, response: Response):
    """Authenticate user and set JWT cookie"""
    try:
        query = "SELECT id, username, email, role, password_hash FROM users WHERE username = %s"
        users = db.execute_query(query, (request.username,))
        
        if not users or not verify_password(request.password, users[0]['password_hash']):
            raise HTTPException(status_code=401, detail="Invalid username or password")
        
        user = users[0]
        
        # Create JWT token
        token_data = {
            "user_id": user['id'],
            "username": user['username'],
            "role": user['role'],
            "exp": datetime.utcnow() + timedelta(days=7)  # Token valide 7 jours
        }
        token = jwt.encode(token_data, SECRET_KEY, algorithm=ALGORITHM)
        
        # Set cookie with JWT
        response.set_cookie(
            key="markd_auth",
            value=token,
            httponly=True,
            max_age=7 * 24 * 60 * 60,  # 7 jours en secondes
            samesite="lax",
            secure=USE_SECURE_COOKIE  # Only True in production with HTTPS
        )
        
        return {
            "success": True,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role']
            }
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/logout")
async def logout(response: Response):
    """Logout user by clearing JWT cookie"""
    response.delete_cookie(key="markd_auth")
    return {"success": True, "message": "Logged out successfully"}

@router.get("/auth/me")
async def get_current_user_info(request: Request):
    """Get current user info from JWT cookie"""
    try:
        token = request.cookies.get("markd_auth")
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Fetch user from database
        query = "SELECT id, username, email, role FROM users WHERE id = %s"
        users = db.execute_query(query, (user_id,))
        
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        user = users[0]
        return {
            "success": True,
            "user": {
                "id": user['id'],
                "username": user['username'],
                "email": user['email'],
                "role": user['role']
            }
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/users/me/groups")
async def get_my_groups_and_permissions(request: Request):
    """Get current user's groups and workspace permissions"""
    try:
        token = request.cookies.get("markd_auth")
        if not token:
            raise HTTPException(status_code=401, detail="Not authenticated")
        
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        
        # Get user's groups
        groups_query = """
            SELECT ugt.id, ugt.name, ugt.description
            FROM user_groups ug
            JOIN user_groups_table ugt ON ug.group_id = ugt.id
            WHERE ug.user_id = %s
            ORDER BY ugt.name
        """
        groups = db.execute_query(groups_query, (user_id,))
        
        # Get user's workspace permissions via groups
        permissions_query = """
            SELECT DISTINCT
                w.id as workspace_id,
                w.name as workspace_name,
                w.description as workspace_description,
                MAX(
                    CASE gwp.permission_level
                        WHEN 'admin' THEN 3
                        WHEN 'write' THEN 2
                        WHEN 'read' THEN 1
                        ELSE 0
                    END
                ) as max_level,
                (SELECT gwp2.permission_level 
                 FROM group_workspace_permissions gwp2
                 JOIN user_groups ug2 ON gwp2.group_id = ug2.group_id
                 WHERE ug2.user_id = %s 
                   AND gwp2.workspace_id = w.id
                 ORDER BY 
                    CASE gwp2.permission_level
                        WHEN 'admin' THEN 3
                        WHEN 'write' THEN 2
                        WHEN 'read' THEN 1
                        ELSE 0
                    END DESC
                 LIMIT 1) as permission_level
            FROM user_groups ug
            JOIN group_workspace_permissions gwp ON ug.group_id = gwp.group_id
            JOIN workspaces w ON gwp.workspace_id = w.id
            WHERE ug.user_id = %s
            GROUP BY w.id, w.name, w.description
            ORDER BY w.name
        """
        permissions = db.execute_query(permissions_query, (user_id, user_id))
        
        return {
            "success": True,
            "groups": groups,
            "workspaces": permissions
        }
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Invalid token")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/users")
async def get_users():
    """Get all users (admin only)"""
    try:
        query = """
            SELECT id, username, email, role, created_at
            FROM users
            ORDER BY created_at DESC
        """
        users = db.execute_query(query)
        return {"success": True, "users": users}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/users")
async def create_user(user: CreateUserRequest):
    """Create new user (admin only)"""
    try:
        # Check if username already exists
        check_query = "SELECT id FROM users WHERE username = %s"
        existing = db.execute_query(check_query, (user.username,))
        if existing:
            raise HTTPException(status_code=400, detail="Username already exists")
        
        password_hash = hash_password(user.password)
        
        query = """
            INSERT INTO users (username, email, password_hash, role)
            VALUES (%s, %s, %s, %s)
        """
        db.execute_update(query, (
            user.username,
            user.email,
            password_hash,
            user.role
        ))
        
        # Get the created user ID
        id_query = "SELECT LAST_INSERT_ID() as id"
        result = db.execute_query(id_query)
        user_id = result[0]['id'] if result else None
        
        # Automatically add user to default groups based on role
        if user_id:
            try:
                # Add user to "ALL" group (business group)
                all_group_query = """
                    SELECT id FROM user_groups_table WHERE name = 'ALL' LIMIT 1
                """
                all_group = db.execute_query(all_group_query)
                if all_group:
                    add_to_all_query = """
                        INSERT INTO user_groups (user_id, group_id)
                                VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE user_id=user_id
                    """
                    db.execute_update(add_to_all_query, (user_id, all_group[0]['id']))
                
                # Fetch default "Users" group
                default_group_query = """
                    SELECT id FROM user_groups_table
                    WHERE name = %s
                    LIMIT 1
                """
                default_group = db.execute_query(default_group_query, ('Users',))

                if default_group:
                    add_to_default_query = """
                        INSERT INTO user_groups (user_id, group_id)
                        VALUES (%s, %s)
                        ON DUPLICATE KEY UPDATE user_id=user_id
                    """
                    db.execute_update(add_to_default_query, (user_id, default_group[0]['id']))

                # If the new user is an admin, also add to Administrators group
                if user.role == 'admin':
                    admin_group_query = """
                        SELECT id FROM user_groups_table
                        WHERE name = %s
                        LIMIT 1
                    """
                    admin_group = db.execute_query(admin_group_query, ('Administrators',))
                    if admin_group:
                        db.execute_update(
                            """
                            INSERT INTO user_groups (user_id, group_id)
                            VALUES (%s, %s)
                            ON DUPLICATE KEY UPDATE user_id=user_id
                            """,
                            (user_id, admin_group[0]['id'])
                        )
            except Exception as e:
                print(f"Warning: Could not assign default groups to user {user_id}: {e}")
        
        return {"success": True, "user_id": user_id}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/admin/users/{user_id}")
async def update_user(user_id: str, user: UpdateUserRequest):
    """Update user (admin only)"""
    try:
        updates = []
        params = []
        
        if user.username:
            updates.append("username = %s")
            params.append(user.username)
        
        if user.email:
            updates.append("email = %s")
            params.append(user.email)
        
        if user.password:
            updates.append("password_hash = %s")
            params.append(hash_password(user.password))
        
        if user.role:
            updates.append("role = %s")
            params.append(user.role)
        
        if updates:
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            db.execute_update(query, tuple(params))
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.delete("/admin/users/{user_id}")
async def delete_user(user_id: str):
    """Delete user (admin only)"""
    try:
        query = "DELETE FROM users WHERE id = %s"
        affected = db.execute_update(query, (user_id,))
        
        if affected == 0:
            raise HTTPException(status_code=404, detail="User not found")
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.put("/users/{user_id}")
async def update_profile(user_id: str, user: UpdateUserRequest):
    """Update user profile"""
    try:
        updates = []
        params = []
        
        if user.username:
            updates.append("username = %s")
            params.append(user.username)
        
        if user.email:
            updates.append("email = %s")
            params.append(user.email)
        
        if updates:
            params.append(user_id)
            query = f"UPDATE users SET {', '.join(updates)} WHERE id = %s"
            db.execute_update(query, tuple(params))
        
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/change-password")
async def change_password(request: dict):
    """Change user password"""
    try:
        current_password = request.get('currentPassword')
        new_password = request.get('newPassword')
        user_id = request.get('userId')
        
        # Get current hash
        query = "SELECT password_hash FROM users WHERE id = %s"
        users = db.execute_query(query, (user_id,))
        
        if not users or not verify_password(current_password, users[0]['password_hash']):
            raise HTTPException(status_code=401, detail="Current password is incorrect")
        
        # Validate password
        is_valid, error_msg = validate_password(new_password)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Update password
        new_hash = hash_password(new_password)
        update_query = "UPDATE users SET password_hash = %s WHERE id = %s"
        db.execute_update(update_query, (new_hash, user_id))
        
        return {"success": True}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/forgot-password")
async def forgot_password(request: ForgotPasswordRequest):
    """Request password reset"""
    try:
        # Find user by email
        query = "SELECT id, username, email FROM users WHERE email = %s"
        users = db.execute_query(query, (request.email,))
        
        if not users:
            # Return success even if email not found for security
            return {"success": True, "message": "If the email exists, a reset code has been sent"}
        
        user = users[0]
        
        # Generate reset code
        code = generate_reset_code()
        expires_at = datetime.now() + timedelta(minutes=15)
        
        # Delete old tokens for this user
        db.execute_update("DELETE FROM password_reset_tokens WHERE user_id = %s", (user['id'],))
        
        # Insert new token
        insert_query = """
            INSERT INTO password_reset_tokens (user_id, token, expires_at)
            VALUES (%s, %s, %s)
        """
        db.execute_update(insert_query, (user['id'], code, expires_at))
        
        # Send email
        send_password_reset_email(user['email'], user['username'], code)
        
        return {"success": True, "message": "Reset code sent"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/verify-reset-code")
async def verify_reset_code(request: VerifyCodeRequest):
    """Verify reset code"""
    try:
        # Find user by email
        user_query = "SELECT id FROM users WHERE email = %s"
        users = db.execute_query(user_query, (request.email,))
        
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = users[0]['id']
        
        # Check if code is valid
        token_query = """
            SELECT id FROM password_reset_tokens 
            WHERE user_id = %s AND token = %s 
            AND expires_at > NOW() AND used = 0
        """
        tokens = db.execute_query(token_query, (user_id, request.code))
        
        if not tokens:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        
        return {"success": True, "message": "Code verified"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/auth/reset-password")
async def reset_password(request: ResetPasswordRequest):
    """Reset password with code"""
    try:
        # Validate password
        is_valid, error_msg = validate_password(request.newPassword)
        if not is_valid:
            raise HTTPException(status_code=400, detail=error_msg)
        
        # Find user by email
        user_query = "SELECT id FROM users WHERE email = %s"
        users = db.execute_query(user_query, (request.email,))
        
        if not users:
            raise HTTPException(status_code=404, detail="User not found")
        
        user_id = users[0]['id']
        
        # Verify code is valid
        token_query = """
            SELECT id FROM password_reset_tokens 
            WHERE user_id = %s AND token = %s 
            AND expires_at > NOW() AND used = 0
        """
        tokens = db.execute_query(token_query, (user_id, request.code))
        
        if not tokens:
            raise HTTPException(status_code=400, detail="Invalid or expired code")
        
        # Update password
        new_hash = hash_password(request.newPassword)
        update_query = "UPDATE users SET password_hash = %s WHERE id = %s"
        db.execute_update(update_query, (new_hash, user_id))
        
        # Mark token as used
        mark_used_query = "UPDATE password_reset_tokens SET used = 1 WHERE id = %s"
        db.execute_update(mark_used_query, (tokens[0]['id'],))
        
        return {"success": True, "message": "Password reset successfully"}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/admin/test-email")
async def test_email(request: TestEmailRequest):
    """Send test email (admin only)"""
    try:
        # Create simple HTML email
        html_content = """
        <!DOCTYPE html>
        <html>
        <head>
            <meta charset="utf-8">
            <style>
                body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
                .content { background: #ffffff; padding: 30px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 8px 8px; }
                .button { display: inline-block; background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; margin: 20px 0; }
                .footer { text-align: center; color: #6b7280; font-size: 12px; margin-top: 20px; }
            </style>
        </head>
        <body>
            <div class="container">
                <div class="header">
                    <h1>📝 MarkD</h1>
                    <p>Email sending test</p>
                </div>
                <div class="content">
                    <h2>Test email successful!</h2>
                    <p>This is a test email to verify the SMTP Mailjet configuration.</p>
                    <p><strong>Configuration:</strong></p>
                    <ul>
                        <li>Provider: Mailjet</li>
                        <li>Host: in-v3.mailjet.com</li>
                        <li>Port: 587 (TLS)</li>
                        <li>From: xavier@ooo.ovh</li>
                    </ul>
                    <p>If you receive this email, the configuration is working correctly! ✅</p>
                </div>
                <div class="footer">
                    <p>© 2025 MarkD Documentation Manager</p>
                </div>
            </div>
        </body>
        </html>
        """
        
        success = send_email(
            request.email,
            "Test email - MarkD",
            html_content
        )
        
        if success:
            return {"success": True, "message": "Test email sent successfully"}
        else:
            raise HTTPException(status_code=500, detail="Failed to send email. Check SMTP configuration (MAIL_HOST, MAIL_USERNAME, MAIL_PASSWORD in .env)")
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e) or "Unknown error sending email")

# Dependency for JWT authentication
async def get_current_user(request: Request) -> dict:
    """Get current user from JWT token in cookie"""
    import jwt
    
    # Use the same SECRET_KEY and ALGORITHM as defined at the top of the file
    token = request.cookies.get("markd_auth")
    if not token:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id = payload.get("user_id")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
        return {
            "id": user_id,
            "username": payload.get("username"),
            "role": payload.get("role")
        }
    except Exception as e:
        print(f"JWT decode error: {e}")  # Debug
        raise HTTPException(status_code=401, detail=f"Invalid token: {str(e)}")
