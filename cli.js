#!/usr/bin/env node

/**
 * Основной файл командной строки для работы с морфологическими словарями
 * 
 * Поддерживает следующие команды:
 * - add: добавление слов в словарь
 * - delete: удаление слов из словаря
 * - sort: сортировка словаря и удаление дубликатов
 */

import { createReadStream, createWriteStream } from 'fs';
import iconv from 'iconv-lite';
import readline from 'readline';
import { pipeline } from 'stream/promises';
import { detectEncoding } from './detectEncoding.js';

/**
 * Читает файл построчно с учетом кодировки
 * 
 * @param {string} filePath - Путь к файлу
 * @param {string} encoding - Кодировка файла
 * @returns {Promise<string[]>} - Массив строк из файла
 */
async function readFileLines(filePath, encoding) {
  const lines = [];
  
  // Создаем поток для чтения
  const fileStream = createReadStream(filePath);
  const decoder = iconv.decodeStream(encoding);
  
  const rl = readline.createInterface({
    input: fileStream.pipe(decoder),
    crlfDelay: Infinity
  });
  
  // Читаем файл построчно
  for await (const line of rl) {
    if (line.trim()) { // Пропускаем пустые строки
      lines.push(line);
    }
  }
  
  return lines;
}

/**
 * Записывает строки в файл с указанной кодировкой
 * 
 * @param {string} filePath - Путь к файлу
 * @param {string[]} lines - Массив строк для записи
 * @param {string} encoding - Кодировка для записи
 * @returns {Promise<void>}
 */
async function writeFileLines(filePath, lines, encoding) {
  try {
    const fileStream = createWriteStream(filePath);
    const encoder = iconv.encodeStream(encoding);
    
    await pipeline(
      async function* () {
        for (const line of lines) {
          yield `${line}\n`;
        }
      },
      encoder,
      fileStream
    );
    
    console.log(`Файл успешно сохранен: ${filePath} (${encoding})`);
  } catch (error) {
    console.error(`Ошибка при записи файла ${filePath}:`, error.message);
    throw error;
  }
}

/**
 * Добавляет слова из второго файла в первый файл
 * 
 * @param {string} dictPath - Путь к словарю
 * @param {string} newWordsPath - Путь к файлу с новыми словами
 * @returns {Promise<void>}
 */
async function addWords(dictPath, newWordsPath) {
  try {
    console.log(`Добавление слов из ${newWordsPath} в ${dictPath}...`);
    
    // Определяем кодировки файлов
    const dictEncoding = await detectEncoding(dictPath);
    const newWordsEncoding = await detectEncoding(newWordsPath);
    
    console.log(`Кодировка словаря: ${dictEncoding}`);
    console.log(`Кодировка файла с новыми словами: ${newWordsEncoding}`);
    
    // Читаем файлы построчно
    const dictLines = await readFileLines(dictPath, dictEncoding);
    const newLines = await readFileLines(newWordsPath, newWordsEncoding);
    
    // Создаем Set для удаления дубликатов при добавлении
    const wordSet = new Set(dictLines);
    const originalCount = wordSet.size;
    
    // Добавляем новые слова
    let addedCount = 0;
    for (const word of newLines) {
      if (!wordSet.has(word)) {
        wordSet.add(word);
        addedCount++;
      }
    }
    
    // Преобразуем обратно в массив и сортируем
    const sortedWords = Array.from(wordSet)
      .sort((a, b) => a.localeCompare(b, 'ru'));
    
    // Сохраняем результат в оригинальной кодировке словаря
    await writeFileLines(dictPath, sortedWords, dictEncoding);
    
    console.log(`Добавлено ${addedCount} слов. Всего слов в словаре: ${sortedWords.length}`);
  } catch (error) {
    console.error('Ошибка при добавлении слов:', error.message);
    process.exit(1);
  }
}

/**
 * Удаляет слова из словаря
 * 
 * @param {string} dictPath - Путь к словарю
 * @param {string} wordsToDeletePath - Путь к файлу со словами для удаления
 * @returns {Promise<void>}
 */
async function deleteWords(dictPath, wordsToDeletePath) {
  try {
    console.log(`Удаление слов из ${dictPath} на основе ${wordsToDeletePath}...`);
    
    // Определяем кодировки файлов
    const dictEncoding = await detectEncoding(dictPath);
    const deleteEncoding = await detectEncoding(wordsToDeletePath);
    
    console.log(`Кодировка словаря: ${dictEncoding}`);
    console.log(`Кодировка файла со словами для удаления: ${deleteEncoding}`);
    
    // Читаем файлы построчно
    const dictLines = await readFileLines(dictPath, dictEncoding);
    const deleteLines = await readFileLines(wordsToDeletePath, deleteEncoding);
    
    // Создаем Set для быстрого поиска
    const deleteSet = new Set(deleteLines);
    
    // Удаляем слова
    const result = dictLines.filter(word => !deleteSet.has(word));
    const deletedCount = dictLines.length - result.length;
    
    // Сохраняем результат в оригинальной кодировке словаря
    await writeFileLines(dictPath, result, dictEncoding);
    
    console.log(`Удалено ${deletedCount} слов. Осталось слов в словаре: ${result.length}`);
  } catch (error) {
    console.error('Ошибка при удалении слов:', error.message);
    process.exit(1);
  }
}

/**
 * Сортирует словарь и удаляет дубликаты
 * 
 * @param {string} dictPath - Путь к словарю
 * @returns {Promise<void>}
 */
async function sortDictionary(dictPath) {
  try {
    console.log(`Сортировка словаря ${dictPath}...`);
    
    // Определяем кодировку файла
    const encoding = await detectEncoding(dictPath);
    console.log(`Кодировка словаря: ${encoding}`);
    
    // Читаем файл построчно
    const lines = await readFileLines(dictPath, encoding);
    console.log(`Прочитано строк: ${lines.length}`);
    
    // Удаляем дубликаты
    const uniqueWords = new Set(lines);
    
    // Сортируем слова
    const sortedWords = Array.from(uniqueWords).sort((a, b) => 
      a.localeCompare(b, 'ru')
    );
    
    // Считаем сколько дубликатов было удалено
    const duplicatesRemoved = lines.length - sortedWords.length;
    
    // Сохраняем результат в оригинальной кодировке словаря
    await writeFileLines(dictPath, sortedWords, encoding);
    
    console.log(`Словарь отсортирован. Удалено дубликатов: ${duplicatesRemoved}. Всего слов: ${sortedWords.length}`);
  } catch (error) {
    console.error('Ошибка при сортировке словаря:', error.message);
    process.exit(1);
  }
}

/**
 * Выводит справку по использованию программы
 */
function printHelp() {
  console.log(`
    Использование: node cli.js <команда> [параметры]

    Команды:
    add <файл_словарь> <файл_с_новыми_словами> - Добавить слова в словарь
    delete <файл> <файл_с_лишними_словами> - Удалить слова из словаря
    sort <файл> - Сортировать словарь и удалить дубликаты
    
    Примеры:
    node cli.js add словари/животные.txt ./новые_слова_животных.txt 
    node cli.js delete словари/животные.txt ./лишние_слова_животных.txt 
    node cli.js sort словари/животные.txt
  `);
}

/**
 * Основная функция для обработки команд из командной строки
 */
async function main() {
  // Получаем аргументы командной строки
  const args = process.argv.slice(2);
  const command = args[0];

  if (!command || args.length < 2) {
    printHelp();
    process.exit(args.length === 0 ? 0 : 1);
    return;
  }

  try {
    switch (command) {
      case 'add':
        if (args.length < 3) {
          console.error('Ошибка: необходимо указать путь к словарю и файл с новыми словами');
          printHelp();
          process.exit(1);
        }
        await addWords(args[1], args[2]);
        break;
        
      case 'delete':
        if (args.length < 3) {
          console.error('Ошибка: необходимо указать путь к словарю и файл со словами для удаления');
          printHelp();
          process.exit(1);
        }
        await deleteWords(args[1], args[2]);
        break;
        
      case 'sort':
        await sortDictionary(args[1]);
        break;
        
      default:
        console.error(`Неизвестная команда: ${command}`);
        printHelp();
        process.exit(1);
    }
  } catch (error) {
    console.error('Произошла ошибка:', error.message);
    process.exit(1);
  }
}

// Запуск основной функции
main();