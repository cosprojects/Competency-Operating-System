// AXIONA — диагностика окружения Figma.
// Мини-плагин: проверяет, что запуск плагинов работает, и собирает факты,
// от которых зависит основной сборщик (шрифт Geist, createImage, SVG).
(async () => {
  const lines = [];
  const add = (line) => lines.push(line);

  add(`AXIONA · диагностика Figma`);
  add(`время: ${new Date().toISOString()}`);
  add('');

  try {
    add(`страниц в файле: ${figma.root.children.length}`);
    add(`текущая страница: ${figma.currentPage.name}`);
    add(`editorType: ${figma.editorType ?? '—'}`);
    add('');
  } catch (error) {
    add(`страницы: ошибка ${error.message}`);
  }

  try {
    const fonts = await figma.listAvailableFontsAsync();
    const geist = fonts.filter((item) => /geist/i.test(item.fontName.family));
    const families = [...new Set(geist.map((item) => item.fontName.family))];
    add(`шрифтов всего: ${fonts.length}`);
    add(`семейства Geist: ${families.length ? families.join(', ') : 'НЕ НАЙДЕНЫ'}`);
    for (const family of families) {
      const styles = [...new Set(geist.filter((item) => item.fontName.family === family).map((item) => item.fontName.style))];
      add(`  ${family} → ${styles.join(' / ')}`);
    }
    const probe = families.length
      ? geist[0].fontName
      : { family: 'Inter', style: 'Regular' };
    try {
      await figma.loadFontAsync(probe);
      add(`loadFontAsync: ok (${probe.family} ${probe.style})`);
    } catch (error) {
      add(`loadFontAsync: ошибка ${error.message}`);
    }
  } catch (error) {
    add(`listAvailableFontsAsync: ошибка ${error.message}`);
  }
  add('');

  try {
    // Настоящий PNG 1×1: невалидные байты Figma отвергает, и тест был бы ложным.
    const png =
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    const bytes = Uint8Array.from(atob(png), (char) => char.charCodeAt(0));
    const image = figma.createImage(bytes);
    const ok = Boolean(image && image.hash);
    add(`createImage: ${ok ? 'ok' : 'нет hash'} (${bytes.length} байт)`);
    if (ok) {
      const probe = figma.createRectangle();
      probe.fills = [{ type: 'IMAGE', imageHash: image.hash, scaleMode: 'FILL' }];
      probe.remove();
      add('image paint: ok');
    }
  } catch (error) {
    add(`createImage: ошибка ${error.message}`);
  }

  try {
    const svg = figma.createNodeFromSvg(
      '<svg width="24" height="24" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M4 12h16" stroke="#4F46E5" stroke-width="2" fill="none"/></svg>',
    );
    add(`createNodeFromSvg: ok (${Math.round(svg.width)}×${Math.round(svg.height)})`);
    svg.remove();
  } catch (error) {
    add(`createNodeFromSvg: ошибка ${error.message}`);
  }

  // Показываем результат отдельной страницей, чтобы его нельзя было пропустить.
  let page = figma.root.children.find((node) => node.type === 'PAGE' && node.name === 'SMOKE · диагностика');
  if (!page) {
    page = figma.createPage();
    page.name = 'SMOKE · диагностика';
  }
  for (const child of [...page.children]) child.remove();
  figma.currentPage = page;
  figma.root.insertChild(0, page);

  let font = { family: 'Inter', style: 'Regular' };
  try {
    const fonts = await figma.listAvailableFontsAsync();
    const geist = fonts.find((item) => /geist/i.test(item.fontName.family) && /regular/i.test(item.fontName.style));
    if (geist) font = geist.fontName;
  } catch (error) {
    /* Inter по умолчанию */
  }
  await figma.loadFontAsync(font);

  const frame = figma.createFrame();
  frame.name = 'SMOKE · диагностика';
  frame.resize(760, 60 + lines.length * 22);
  frame.fills = [{ type: 'SOLID', color: { r: 0.97, g: 0.98, b: 1 }, opacity: 1 }];
  frame.clipsContent = false;
  page.appendChild(frame);
  frame.x = 0;
  frame.y = 0;

  const text = figma.createText();
  text.fontName = font;
  text.characters = lines.join('\n');
  text.fontSize = 13;
  text.fills = [{ type: 'SOLID', color: { r: 0.07, g: 0.13, b: 0.22 }, opacity: 1 }];
  frame.appendChild(text);
  text.x = 20;
  text.y = 20;
  text.resize(720, 20);
  text.textAutoResize = 'HEIGHT';

  figma.viewport.scrollAndZoomIntoView([frame]);
  figma.notify('Диагностика готова: страница «SMOKE · диагностика»', { timeout: 8000 });
  figma.closePlugin();
})().catch((error) => {
  figma.notify(`SMOKE упал: ${String(error && error.message ? error.message : error)}`, {
    error: true,
    timeout: 20000,
  });
  figma.closePlugin();
});
