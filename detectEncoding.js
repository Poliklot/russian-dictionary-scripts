import { readFile } from 'fs/promises';
import iconv from 'iconv-lite';

/**
 * Определяет кодировку файла (только UTF-8 или Windows-1251)
 * @param {string} filePath - Путь к файлу
 * @returns {Promise<string>} - Определенная кодировка
 */
async function detectEncoding(filePath) {
  try {
    // Читаем файл
    const buffer = await readFile(filePath, { flag: 'r', encoding: null });

    // Проверка UTF-8
    try {
      const utf8Decoded = buffer.toString('utf8');
      if (/[А-Яа-я]/.test(utf8Decoded) && !/�/.test(utf8Decoded)) {
        return 'utf-8';
      }
    } catch {}

    // Проверка Windows-1251
    const windows1251Decoded = iconv.decode(buffer, 'windows-1251');
    if (/[А-Яа-я]/.test(windows1251Decoded) && !/�/.test(windows1251Decoded)) {
      return 'windows-1251';
    }

    // Если ни то, ни другое
    return 'unknown';
  } catch (error) {
    return 'unknown';
  }
}

// Пример использования
async function main() {
  try {
    const filePath = process.argv[2];
    if (!filePath) {
      console.error('Укажите путь к файлу');
      process.exit(1);
    }
    const encoding = await detectEncoding(filePath);
    console.log(encoding);
  } catch (error) {
    console.error('Ошибка:', error);
    process.exit(1);
  }
}

// Запуск только если файл запущен напрямую
if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}

export { detectEncoding };