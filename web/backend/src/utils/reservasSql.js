// Fragmento SQL: la reserva (alias dado) pertenece a un cliente que NO fue eliminado.
// Las reservas de fichas eliminadas se conservan como historial, pero no ocupan cupo
// ni cuentan en la ocupación actual.
function reservaVigente(alias = 'r') {
  return `NOT EXISTS (SELECT 1 FROM clientes ce WHERE ce.id = ${alias}.cliente_id AND ce.estado = 'eliminado')`;
}

module.exports = { reservaVigente };
