-- Подключаем необходимые компоненты
local component = require("component")
local internet = require("internet")
local filesystem = require("filesystem")
local shell = require("shell")

-- Функция для загрузки файла
local function downloadFile(url, path)
  print("Загрузка файла: " .. url)
  local result, response = pcall(internet.request, url)
  if not result then
    print("Ошибка при запросе: " .. response)
    return false
  end

  local data = ""
  for chunk in response do
    data = data .. chunk
  end

  -- Создаем папки, если они не существуют
  local directory = filesystem.path(path)
  if not filesystem.exists(directory) then
    filesystem.makeDirectory(directory)
  end

  -- Сохраняем файл
  local file = io.open(path, "w")
  if not file then
    print("Ошибка: не удалось создать файл " .. path)
    return false
  end

  file:write(data)
  file:close()
  print("Файл успешно загружен: " .. path)
  return true
end

-- Функция для рекурсивной загрузки папок и файлов
local function downloadRepository(repoUrl, basePath)
  -- Преобразуем URL в raw-формат
  local rawUrl = repoUrl:gsub("github.com", "raw.githubusercontent.com"):gsub("/tree", "")

  -- Запрашиваем список файлов и папок (используем GitHub API через raw-ссылку)
  -- Внимание: это упрощенный подход, который работает только для публичных репозиториев
  local listingUrl = repoUrl:gsub("github.com", "api.github.com/repos") .. "/contents"
  local result, response = pcall(internet.request, listingUrl)
  if not result then
    print("Ошибка при запросе списка файлов: " .. response)
    return
  end

  local data = ""
  for chunk in response do
    data = data .. chunk
  end

  -- Парсим JSON (в OpenComputers нет встроенного JSON-парсера, поэтому используем простой подход)
  local files = {}
  for line in data:gmatch("[^\r\n]+") do
    if line:find('"type": "file"') then
      local fileUrl = line:match('"download_url": "([^"]+)"')
      local fileName = line:match('"path": "([^"]+)"')
      if fileUrl and fileName then
        table.insert(files, {url = fileUrl, path = fileName})
      end
    elseif line:find('"type": "dir"') then
      local dirName = line:match('"path": "([^"]+)"')
      if dirName then
        downloadRepository(repoUrl .. "/" .. dirName, basePath)
      end
    end
  end

  -- Загружаем файлы
  for _, file in ipairs(files) do
    local savePath = filesystem.concat(basePath, file.path)
    downloadFile(file.url, savePath)
  end
end

-- Основная функция
local function main()
  print("Введите URL репозитория GitHub (например, https://github.com/username/repo/tree/branch):")
  local repoUrl = io.read()

  -- Указываем папку для сохранения
  local savePath = "/home/repository"
  if not filesystem.exists(savePath) then
    filesystem.makeDirectory(savePath)
  end

  -- Загружаем репозиторий
  downloadRepository(repoUrl, savePath)
  print("Загрузка репозитория завершена.")
end

-- Запуск программы
main()
