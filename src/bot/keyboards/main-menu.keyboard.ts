import { Markup } from 'telegraf';

export const mainMenuKeyboard = () =>
  Markup.keyboard([
    ['📅 Qabulga yozilish', '💼 Xizmatlar'],
    ['❓ Tez-tez so\'raladigan savollar', '📍 Manzil'],
    ['📋 Qabullarim', '📞 Bog\'lanish'],
  ])
    .resize()
    .persistent();

export const cancelKeyboard = () =>
  Markup.keyboard([['❌ Bekor qilish']])
    .resize()
    .oneTime();

export const nameStepKeyboard = () =>
  Markup.keyboard([['⬅️ Orqaga', '❌ Bekor qilish']])
    .resize()
    .oneTime();

export const phoneStepKeyboard = () =>
  Markup.keyboard([
    [Markup.button.contactRequest('📱 Telefon raqamni yuborish')],
    ['⬅️ Orqaga', '❌ Bekor qilish'],
  ])
    .resize()
    .oneTime();

export const confirmKeyboard = () =>
  Markup.keyboard([
    ['✅ Tasdiqlash'],
    ['⬅️ Orqaga', '❌ Bekor qilish'],
  ])
    .resize()
    .oneTime();

export const sharePhoneKeyboard = phoneStepKeyboard;
