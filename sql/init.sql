CREATE TABLE IF NOT EXISTS article (
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    id INTEGER PRIMARY KEY AUTOINCREMENT
);

CREATE TABLE IF NOT EXISTS tag (
    tag_name TEXT NOT NULL,
    article_id INTEGER NOT NULL,
    FOREIGN KEY(article_id) REFERENCES article(id)
);
