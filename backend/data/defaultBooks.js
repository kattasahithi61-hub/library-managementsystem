import Book from '../models/Book.js'

export const defaultBooks = [
  ['1984', 'George Orwell', '9780451524935', 'Fiction', 'Signet Classics', 'A dystopian novel about surveillance, truth, and individual freedom.', 5],
  ['The Great Gatsby', 'F. Scott Fitzgerald', '9780743273565', 'Fiction', 'Scribner', 'A portrait of ambition, wealth, and the American Dream in the Jazz Age.', 4],
  ['To Kill a Mockingbird', 'Harper Lee', '9780061120084', 'Fiction', 'Harper Perennial', 'A coming-of-age story confronting injustice and empathy in the American South.', 5],
  ['Pride and Prejudice', 'Jane Austen', '9780141439518', 'Classic', 'Penguin Classics', 'A sharp romantic comedy of manners centered on Elizabeth Bennet and Mr. Darcy.', 4],
  ['The Catcher in the Rye', 'J. D. Salinger', '9780316769488', 'Fiction', 'Little, Brown and Company', 'Holden Caulfield recounts several turbulent days in New York City.', 3],
  ['The Alchemist', 'Paulo Coelho', '9780061122415', 'Fiction', 'HarperOne', 'A shepherd follows recurring dreams in search of a treasure near the pyramids.', 4],
  ['The Hobbit', 'J. R. R. Tolkien', '9780547928227', 'Fantasy', 'Mariner Books', 'Bilbo Baggins joins a quest to reclaim a mountain treasure from a dragon.', 5],
  ['The Fellowship of the Ring', 'J. R. R. Tolkien', '9780547928210', 'Fantasy', 'Mariner Books', 'The first part of the journey to destroy the One Ring.', 4],
  ["Harry Potter and the Sorcerer's Stone", 'J. K. Rowling', '9780590353427', 'Fantasy', 'Scholastic', 'A boy discovers he is a wizard and begins school at Hogwarts.', 6],
  ['The Hunger Games', 'Suzanne Collins', '9780439023481', 'Young Adult', 'Scholastic Press', 'Katniss Everdeen volunteers for a televised fight for survival.', 4],
  ['The Book Thief', 'Markus Zusak', '9780375842207', 'Historical Fiction', 'Knopf Books for Young Readers', 'Death narrates the story of a foster girl in Nazi Germany who steals books.', 3],
  ['The Kite Runner', 'Khaled Hosseini', '9781594631931', 'Historical Fiction', 'Riverhead Books', 'A story of friendship, betrayal, and redemption set across Afghanistan and America.', 3],
  ['Sapiens', 'Yuval Noah Harari', '9780062316097', 'History', 'Harper', 'An exploration of how Homo sapiens came to dominate the world.', 4],
  ['A Brief History of Time', 'Stephen Hawking', '9780553380163', 'Science', 'Bantam', 'An accessible introduction to cosmology, black holes, and the nature of time.', 3],
  ['The Gene', 'Siddhartha Mukherjee', '9781476733500', 'Science', 'Scribner', 'A history and investigation of the science and meaning of heredity.', 3],
  ['Atomic Habits', 'James Clear', '9780735211292', 'Self Help', 'Avery', 'Practical strategies for building good habits and breaking unhelpful ones.', 5],
  ['Deep Work', 'Cal Newport', '9781455586691', 'Productivity', 'Grand Central Publishing', 'Rules for focused success in a distracted world.', 4],
  ['Clean Code', 'Robert C. Martin', '9780132350884', 'Technology', 'Prentice Hall', 'A handbook of practices for writing readable, maintainable software.', 4],
  ['The Pragmatic Programmer', 'David Thomas and Andrew Hunt', '9780135957059', 'Technology', 'Addison-Wesley Professional', 'A guide to practical thinking and craft in software development.', 4],
  ['Designing Data-Intensive Applications', 'Martin Kleppmann', '9781449373320', 'Technology', "O'Reilly Media", 'Principles behind reliable, scalable, and maintainable data systems.', 3],
].map(([title, author, isbn, category, publisher, description, totalCopies]) => ({
  title,
  author,
  isbn,
  category,
  publisher,
  description,
  totalCopies,
  availableCopies: totalCopies,
  coverImage: `https://covers.openlibrary.org/b/isbn/${isbn}-L.jpg?default=false`,
}))

export async function ensureDefaultBooks() {
  const result = await Book.bulkWrite(defaultBooks.map((book) => ({
    updateOne: {
      filter: { isbn: book.isbn },
      update: { $setOnInsert: book },
      upsert: true,
    },
  })))

  return {
    added: result.upsertedCount,
    existing: defaultBooks.length - result.upsertedCount,
  }
}
