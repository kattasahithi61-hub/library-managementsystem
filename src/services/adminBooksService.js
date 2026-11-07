import axios from 'axios'
import { API_BASE_URL } from './apiConfig.js'

const adminBooksApi = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
})

export async function fetchAdminBooks({ search, category, signal } = {}) {
  const response = await adminBooksApi.get('/admin/books', {
    signal,
    params: {
      ...(search?.trim() ? { search: search.trim() } : {}),
      ...(category && category !== 'All Books' ? { category } : {}),
    },
  })
  return response.data.books
}

export async function createBook(book) {
  const response = await adminBooksApi.post('/books', book)
  return response.data.book
}

export async function updateBook(id, book) {
  const response = await adminBooksApi.put(`/books/${encodeURIComponent(id)}`, book)
  return response.data.book
}

export async function deleteBook(id) {
  const response = await adminBooksApi.delete(`/books/${encodeURIComponent(id)}`)
  return response.data
}
