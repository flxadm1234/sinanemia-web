import asyncio
import os
import tempfile
from datetime import datetime

from dotenv import load_dotenv
from telegram import Update
from telegram.ext import Application, CommandHandler, ContextTypes, MessageHandler, filters

from tamizaje_importer import connect_db, ensure_tables, job_update, run_import


def load_env():
  load_dotenv(os.getenv("TAMIZAJE_DOTENV", ".env.local"), override=False)
  load_dotenv(override=False)


async def start(update: Update, _context: ContextTypes.DEFAULT_TYPE):
  await update.message.reply_text(
    "Envíame un Excel (.xlsx/.xls) con la plantilla de tamizaje y lo cargaré en segundo plano."
  )


async def handle_doc(update: Update, context: ContextTypes.DEFAULT_TYPE):
  doc = update.message.document
  if not doc:
    return
  name = (doc.file_name or "").lower()
  if not (name.endswith(".xlsx") or name.endswith(".xls")):
    await update.message.reply_text("Archivo inválido. Debe ser .xlsx o .xls")
    return

  await update.message.reply_text("Descargando archivo...")
  tf = tempfile.NamedTemporaryFile(delete=False, suffix=".xlsx")
  tf.close()
  f = await context.bot.get_file(doc.file_id)
  await f.download_to_drive(tf.name)

  job_id = f"tg-{int(datetime.utcnow().timestamp())}-{doc.file_unique_id}"
  msg = await update.message.reply_text(f"Iniciando importación. Job: {job_id}")

  try:
    db = connect_db()
    cur = db.cursor()
    ensure_tables(cur)
    db.commit()
    cur.execute(
      """
      INSERT INTO tamizaje_import_jobs
        (id, status, progress, total_rows, processed_rows, inserted_rows, file_name, source, requested_by)
      VALUES (%s, 'queued', 0, 0, 0, 0, %s, 'telegram', %s)
      """,
      [job_id, os.path.basename(tf.name), str(update.effective_user.id)],
    )
    db.commit()
    db.close()
  except Exception:
    pass

  loop = asyncio.get_running_loop()

  def _run():
    return run_import(job_id, tf.name)

  await loop.run_in_executor(None, _run)
  await msg.edit_text(f"Importación finalizada. Job: {job_id}")


def main():
  load_env()
  token = os.getenv("TELEGRAM_BOT_TOKEN", "").strip()
  if not token:
    raise SystemExit("Falta TELEGRAM_BOT_TOKEN")
  app = Application.builder().token(token).build()
  app.add_handler(CommandHandler("start", start))
  app.add_handler(MessageHandler(filters.Document.ALL, handle_doc))
  app.run_polling()


if __name__ == "__main__":
  main()

