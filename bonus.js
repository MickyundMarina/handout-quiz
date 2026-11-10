/* Gleiche Erkennung wie quiz_has_67_bonus in supabase-setup.sql. */
window.has67Bonus = name => {
 const compact=String(name).replace(/[０-９Ａ-Ｚａ-ｚ]/g,c=>String.fromCharCode(c.charCodeAt(0)-0xfee0)).toLowerCase().replace(/[^a-z0-9]/g,'');
 return /67|sixseven|sixtyseven|sechssieben|siebenundsechzig|six7|6seven|sechs7|6sieben|sicksseven/.test(compact);
};
