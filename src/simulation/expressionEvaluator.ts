import type { ExpressionNode } from './expressionParser'

export function evaluateExpression(node: ExpressionNode, values: Record<string, number>): number {
  switch (node.type) {
    case 'number': return node.value
    case 'variable': return values[node.name]
    case 'unary': return node.operator === '-' ? -evaluateExpression(node.operand, values) : evaluateExpression(node.operand, values)
    case 'binary': {
      const left = evaluateExpression(node.left, values)
      const right = evaluateExpression(node.right, values)
      if (node.operator === '+') return left + right
      if (node.operator === '-') return left - right
      if (node.operator === '*') return left * right
      if (node.operator === '/') return left / right
      return left ** right
    }
    case 'call': {
      const args = node.arguments.map((argument) => evaluateExpression(argument, values))
      if (node.name === 'min') return Math.min(...args)
      if (node.name === 'max') return Math.max(...args)
      if (node.name === 'abs') return Math.abs(args[0])
      if (node.name === 'sqrt') return Math.sqrt(args[0])
      if (node.name === 'log') return Math.log(args[0])
      return Math.exp(args[0])
    }
  }
}
