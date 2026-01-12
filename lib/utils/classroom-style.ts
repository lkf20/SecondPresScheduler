type ClassroomPillStyle = {
  backgroundColor?: string
  borderColor?: string
  color?: string
}

export const getClassroomPillStyle = (color: string | null): ClassroomPillStyle => {
  if (!color) return {}
  const hex = color.trim()
  if (!hex.startsWith('#') || (hex.length !== 7 && hex.length !== 4)) {
    return { backgroundColor: color, borderColor: color, color }
  }
  const normalized =
    hex.length === 4 ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}` : hex
  const r = parseInt(normalized.slice(1, 3), 16)
  const g = parseInt(normalized.slice(3, 5), 16)
  const b = parseInt(normalized.slice(5, 7), 16)
  return {
    backgroundColor: `rgba(${r}, ${g}, ${b}, 0.12)`,
    borderColor: `rgba(${r}, ${g}, ${b}, 0.3)`,
    color: normalized,
  }
}
