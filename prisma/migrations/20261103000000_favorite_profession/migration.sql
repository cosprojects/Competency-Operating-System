-- Добавляем сохранение профессий в избранное
ALTER TYPE "FavoriteTarget" ADD VALUE IF NOT EXISTS 'PROFESSION';
