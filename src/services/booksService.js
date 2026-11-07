import axios from 'axios'
import { API_BASE_URL } from './apiConfig.js'

export class BooksApiUnavailableError extends Error {
  constructor() {
    super('The books API is not available yet.')
    this.name = 'BooksApiUnavailableError'
  }
}

export async function fetchBooks({ signal, search, category } = {}) {
  let response
  try {
    response = await axios.get(`${API_BASE_URL}/books`, {
      signal,
      params: {
        ...(search?.trim() ? { search: search.trim() } : {}),
        ...(category && category !== 'All Books' ? { category } : {}),
      },
    })
  } catch (error) {
    if (error.response?.status === 404) throw new BooksApiUnavailableError()
    throw error
  }

  const books = Array.isArray(response.data) ? response.data : response.data?.books
  if (!Array.isArray(books)) {
    throw new Error('The books API returned data in an unexpected format.')
  }

  return books
}
