// Минимальный плагин: проверяет, что окружение плагинов вообще загружается и
// что документ доступен на запись. 1 KB — если падает и он, дело не в бандле.
(async () => {
  figma.notify('hello: плагин загрузился', { timeout: 6000 });
  const page = figma.createPage();
  page.name = 'HELLO · ok';
  figma.currentPage = page;
  figma.root.insertChild(0, page);
  await figma.loadFontAsync({ family: 'Inter', style: 'Regular' });
  const text = figma.createText();
  text.fontName = { family: 'Inter', style: 'Regular' };
  text.characters = 'Окружение плагинов работает, документ доступен на запись.';
  text.fontSize = 24;
  page.appendChild(text);
  text.x = 40;
  text.y = 40;
  figma.viewport.scrollAndZoomIntoView([text]);
  figma.notify('hello: готово — появилась страница HELLO · ok', { timeout: 6000 });
  figma.closePlugin();
})().catch((error) => {
  figma.notify(`hello ошибка: ${String(error && error.message ? error.message : error)}`, {
    error: true,
    timeout: 15000,
  });
  figma.closePlugin();
});
