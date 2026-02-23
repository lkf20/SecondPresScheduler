export const withFixedNow = async <T>(isoDate: string, run: () => Promise<T> | T): Promise<T> => {
  const realNow = Date.now
  const fixed = new Date(isoDate).getTime()
  Date.now = () => fixed
  try {
    return await run()
  } finally {
    Date.now = realNow
  }
}
