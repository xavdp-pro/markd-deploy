"""
Task Scheduler for MarkD
Handles periodic tasks like sending due date reminders
Run with: python task_scheduler.py
"""

import time
import schedule
from datetime import datetime, timedelta
from database import db
from email_service import send_task_due_date_reminder
import os
from dotenv import load_dotenv

load_dotenv()

def check_due_date_reminders():
    """Check for tasks with upcoming due dates and send reminders"""
    print(f"[{datetime.now()}] Checking for tasks with upcoming due dates...")
    
    try:
        # Get tasks due in next 24 hours that haven't been reminded
        tomorrow = (datetime.now() + timedelta(days=1)).strftime('%Y-%m-%d %H:%M:%S')
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        
        query = """
            SELECT 
                t.id, t.title, t.due_date, t.workspace_id,
                u_resp.email as responsible_email,
                u_resp.username as responsible_username
            FROM tasks t
            LEFT JOIN users u_resp ON t.responsible_user_id = u_resp.id
            WHERE t.due_date BETWEEN %s AND %s
            AND t.reminder_sent = FALSE
            AND t.status != 'done'
            AND u_resp.email IS NOT NULL
        """
        
        tasks = db.execute_query(query, (now, tomorrow))
        
        print(f"Found {len(tasks)} tasks with upcoming due dates")
        
        for task in tasks:
            # Get all assigned users
            assigned_query = """
                SELECT u.email, u.username
                FROM task_assignments ta
                JOIN users u ON ta.user_id = u.id
                WHERE ta.task_id = %s AND u.email IS NOT NULL
            """
            assigned_users = db.execute_query(assigned_query, (task['id'],))
            
            # Base task URL
            base_url = os.getenv('FRONTEND_URL', 'http://localhost:5273')
            task_url = f"{base_url}/tasks?task={task['id']}"
            
            # Format due date
            due_date_str = task['due_date'].strftime('%d/%m/%Y à %H:%M')
            
            # Send to responsible user
            if task['responsible_email']:
                print(f"Sending reminder to {task['responsible_email']} for task '{task['title']}'")
                send_task_due_date_reminder(
                    task['responsible_email'],
                    task['responsible_username'],
                    task['title'],
                    task_url,
                    due_date_str
                )
            
            # Send to all assigned users
            for user in assigned_users:
                if user['email'] != task['responsible_email']:  # Avoid duplicate
                    print(f"Sending reminder to {user['email']} for task '{task['title']}'")
                    send_task_due_date_reminder(
                        user['email'],
                        user['username'],
                        task['title'],
                        task_url,
                        due_date_str
                    )
            
            # Mark as reminded
            db.execute_update(
                "UPDATE tasks SET reminder_sent = TRUE WHERE id = %s",
                (task['id'],)
            )
        
        print(f"[{datetime.now()}] Reminder check completed")
        
    except Exception as e:
        print(f"Error checking due date reminders: {e}")
        import traceback
        traceback.print_exc()

def reset_reminder_flags():
    """Reset reminder_sent flag for tasks that have passed their due date"""
    try:
        now = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        query = """
            UPDATE tasks 
            SET reminder_sent = FALSE 
            WHERE due_date < %s AND reminder_sent = TRUE
        """
        affected = db.execute_update(query, (now,))
        if affected > 0:
            print(f"[{datetime.now()}] Reset {affected} reminder flags for past tasks")
    except Exception as e:
        print(f"Error resetting reminder flags: {e}")

def main():
    """Main scheduler loop"""
    print("=== MarkD Task Scheduler Started ===")
    print(f"Starting at: {datetime.now()}")
    print("Checking for due date reminders every hour...")
    print("Press Ctrl+C to stop")
    print()
    
    # Schedule jobs
    schedule.every().hour.do(check_due_date_reminders)
    schedule.every().day.at("00:00").do(reset_reminder_flags)
    
    # Run immediately on start
    check_due_date_reminders()
    
    # Keep running
    try:
        while True:
            schedule.run_pending()
            time.sleep(60)  # Check every minute
    except KeyboardInterrupt:
        print("\n=== MarkD Task Scheduler Stopped ===")

if __name__ == "__main__":
    main()

