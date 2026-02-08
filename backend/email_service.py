import subprocess
import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

load_dotenv()

def compile_mjml_template(template_path: str) -> str:
    """Compile MJML template to HTML"""
    try:
        result = subprocess.run(
            ['mjml', template_path],
            capture_output=True,
            text=True,
            check=True
        )
        return result.stdout
    except Exception as e:
        print(f"Error compiling MJML: {e}")
        return None

def send_email(to_email: str, subject: str, html_content: str) -> bool:
    """Send email using SMTP (Mailjet)"""
    try:
        smtp_host = os.getenv('MAIL_HOST', 'in-v3.mailjet.com')
        smtp_port = int(os.getenv('MAIL_PORT', 587))
        smtp_user = os.getenv('MAIL_USERNAME', '')
        smtp_password = os.getenv('MAIL_PASSWORD', '')
        from_email = os.getenv('MAIL_FROM_ADDRESS', 'xavier@ooo.ovh')
        from_name = os.getenv('MAIL_FROM_NAME', 'MarkD')
        
        msg = MIMEMultipart('alternative')
        msg['Subject'] = subject
        msg['From'] = f'{from_name} <{from_email}>'
        msg['To'] = to_email
        
        # Add HTML part
        html_part = MIMEText(html_content, 'html', 'utf-8')
        msg.attach(html_part)
        
        # Send email via Mailjet SMTP
        with smtplib.SMTP(smtp_host, smtp_port) as server:
            server.starttls()
            server.login(smtp_user, smtp_password)
            server.send_message(msg)
        
        print(f"Email sent successfully to {to_email}")
        return True
    except Exception as e:
        print(f"Error sending email: {e}")
        import traceback
        traceback.print_exc()
        return False

def send_password_reset_email(to_email: str, username: str, code: str) -> bool:
    """Send password reset email with code"""
    template_path = '/apps/markd-v1/app/backend/email_templates/forgot_password.mjml'
    
    # Compile MJML to HTML
    html_content = compile_mjml_template(template_path)
    if not html_content:
        return False
    
    # Replace placeholders
    html_content = html_content.replace('{{USERNAME}}', username)
    html_content = html_content.replace('{{CODE}}', code)
    
    # Send email
    return send_email(
        to_email,
        'MarkD - Password Reset',
        html_content
    )

def send_task_assignment_email(to_email: str, username: str, task_title: str, task_url: str, assigned_by: str) -> bool:
    """Send email when user is assigned to a task"""
    mjml_template = os.path.join(os.path.dirname(__file__), 'email_templates', 'task_assignment.mjml')
    
    html_content = compile_mjml_template(mjml_template)
    if not html_content:
        return False
    
    # Replace placeholders
    html_content = html_content.replace('{{username}}', username)
    html_content = html_content.replace('{{task_title}}', task_title)
    html_content = html_content.replace('{{task_url}}', task_url)
    html_content = html_content.replace('{{assigned_by}}', assigned_by)
    
    subject = f"MarkD - New task assigned: {task_title}"
    
    return send_email(to_email, subject, html_content)

def send_task_due_date_reminder(to_email: str, username: str, task_title: str, task_url: str, due_date: str) -> bool:
    """Send email reminder for task due date"""
    mjml_template = os.path.join(os.path.dirname(__file__), 'email_templates', 'task_due_reminder.mjml')
    
    html_content = compile_mjml_template(mjml_template)
    if not html_content:
        return False
    
    # Replace placeholders
    html_content = html_content.replace('{{username}}', username)
    html_content = html_content.replace('{{task_title}}', task_title)
    html_content = html_content.replace('{{task_url}}', task_url)
    html_content = html_content.replace('{{due_date}}', due_date)
    
    subject = f"MarkD - Due date reminder: {task_title}"
    
    return send_email(to_email, subject, html_content)
