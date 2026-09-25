export type ExpressionNode =
  | { type: 'number'; value: number }
  | { type: 'variable'; name: string }
  | { type: 'unary'; operator: '+' | '-'; operand: ExpressionNode }
  | { type: 'binary'; operator: '+' | '-' | '*' | '/' | '^'; left: ExpressionNode; right: ExpressionNode }
  | { type: 'call'; name: string; arguments: ExpressionNode[] }

const functions = new Set(['min', 'max', 'abs', 'sqrt', 'log', 'exp'])

export class ExpressionError extends Error {}

export function parseExpression(source: string, allowedVariables: Set<string>): ExpressionNode {
  const tokens = source.match(/\s*(?:([A-Za-z_][A-Za-z0-9_]*)|(\d+(?:\.\d+)?)|(.))/gy)
  if (!tokens) throw new ExpressionError('Formula is empty or contains an invalid token.')
  const clean = tokens.map((token) => token.trim()).filter(Boolean)
  let index = 0
  const peek = () => clean[index]
  const take = () => clean[index++]

  function primary(): ExpressionNode {
    const token = take()
    if (!token) throw new ExpressionError('Expected a value.')
    if (/^\d/.test(token)) return { type: 'number', value: Number(token) }
    if (/^[A-Za-z_]/.test(token)) {
      if (peek() === '(') {
        if (!functions.has(token)) throw new ExpressionError(`Unknown function: ${token}`)
        take()
        const args: ExpressionNode[] = []
        if (peek() !== ')') {
          args.push(additive())
          while (peek() === ',') { take(); args.push(additive()) }
        }
        if (take() !== ')') throw new ExpressionError('Expected a closing parenthesis.')
        return { type: 'call', name: token, arguments: args }
      }
      if (!allowedVariables.has(token)) throw new ExpressionError(`Unknown variable: ${token}`)
      return { type: 'variable', name: token }
    }
    if (token === '(') {
      const value = additive()
      if (take() !== ')') throw new ExpressionError('Expected a closing parenthesis.')
      return value
    }
    if (token === '+' || token === '-') return { type: 'unary', operator: token, operand: primary() }
    throw new ExpressionError(`Invalid token: ${token}`)
  }
  function exponent(): ExpressionNode {
    const left = primary()
    return peek() === '^' ? (take(), { type: 'binary', operator: '^', left, right: exponent() }) : left
  }
  function multiplicative(): ExpressionNode {
    let node = exponent()
    while (peek() === '*' || peek() === '/') { const operator = take() as '*' | '/'; node = { type: 'binary', operator, left: node, right: exponent() } }
    return node
  }
  function additive(): ExpressionNode {
    let node = multiplicative()
    while (peek() === '+' || peek() === '-') { const operator = take() as '+' | '-'; node = { type: 'binary', operator, left: node, right: multiplicative() } }
    return node
  }
  const tree = additive()
  if (index !== clean.length) throw new ExpressionError(`Invalid token: ${clean[index]}`)
  return tree
}
