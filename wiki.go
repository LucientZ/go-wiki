package main

import (
	"database/sql"
	"html"
	"log"
	"net/http"
	"os"
	"regexp"
	"strconv"
	"strings"
	"text/template"

	_ "github.com/mattn/go-sqlite3"
)

// Globals
var templates = template.Must(template.ParseFiles("./templates/view.html", "./templates/index.html", "./templates/edit.html"))
var validPath = regexp.MustCompile("^/(edit|save|view)/([a-zA-Z0-9]+)$|^/(new/)?$")

// Information
type ExternalArticles struct {
	ArticleIds    []int64
	ArticleTitles []string
	Tags          []string
}

// Represents information in a given article.
type Article struct {
	Title string
	Id    string
	Body  []byte
	Tags  []string
}

// Saves an article to the database
func (article *Article) save(db *sql.DB) error {
	articleStatement, err := db.Prepare(`
		UPDATE article
		SET title = ?, body = ?
		WHERE id = ?;
	`)
	defer articleStatement.Close()
	if err != nil {
		return err
	}

	_, err = articleStatement.Exec(&article.Title, &article.Body, &article.Id)

	return err
}

// Creates a new article in the database and return the id of the article
func (article *Article) create(db *sql.DB) (int64, error) {
	transaction, err := db.Begin()
	defer func() {
		if err != nil {
			transaction.Rollback()
		} else {
			transaction.Commit()
		}
	}()

	articleStatement, err := transaction.Prepare(`
		INSERT INTO article
		(title, body) VALUES (?, ?);
	`)
	defer articleStatement.Close()

	if err != nil {
		return 0, err
	}

	result, err := articleStatement.Exec(&article.Title, &article.Body)
	if err != nil {
		return 0, err
	}

	articleId, err := result.LastInsertId()
	if err != nil {
		return 0, err
	}

	return articleId, err
}

// Obtains info about other articles
func getOtherArticleInformation(db *sql.DB) (*ExternalArticles, error) {
	// Obtain information about articles
	articleRows, err := db.Query(`
		SELECT id, title FROM article;	
	`)
	if err != nil {
		return nil, err
	}

	tagRows, err := db.Query(`
		SELECT DISTINCT tag_name FROM tag;
	`)
	if err != nil {
		return nil, err
	}

	var articles []int64
	var titles []string
	var tags []string

	for articleRows.Next() {
		var articleId int64
		var articleTitle string
		if err := articleRows.Scan(&articleId, &articleTitle); err != nil {
			return nil, err
		}
		articleTitle = html.EscapeString(articleTitle)
		articles = append(articles, articleId)
		titles = append(titles, articleTitle)
	}

	for tagRows.Next() {
		var tag string
		if err := tagRows.Scan(&tag); err != nil {
			return nil, err
		}
		tag = html.EscapeString(tag)
		tags = append(tags, tag)
	}

	return &ExternalArticles{
		ArticleIds:    articles,
		ArticleTitles: titles,
		Tags:          tags,
	}, nil
}

// Generic function encapsulating the functionality of rendering an article
func renderTemplate(writer http.ResponseWriter, templateName string, pageInfo *Article) {
	err := templates.ExecuteTemplate(writer, templateName+".html", pageInfo)

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}
}

// Collects data about a given article
func loadArticle(articleId string, db *sql.DB) (*Article, error) {
	log.Printf("Loading article with id: %s", articleId)
	var title string
	var body string
	var tags []string
	id, err := strconv.Atoi(articleId)
	if err != nil {
		return nil, err
	}

	// Collect data about article
	articleStatement, err := db.Prepare(`
		SELECT title, body FROM article
		WHERE id = ?;
	`)
	defer articleStatement.Close()
	if err != nil {
		return nil, err
	}

	if err = articleStatement.QueryRow(id).Scan(&title, &body); err != nil {
		return nil, err
	}

	// Collect metadata about article
	tagStatement, err := db.Prepare(`
		SELECT tag_name FROM tag
		WHERE article_id = ?;
	`)
	defer tagStatement.Close()
	if err != nil {
		return nil, err
	}

	rows, err := tagStatement.Query(id)
	if err != nil {
		return nil, err
	}
	for rows.Next() {
		var tagName string
		err = rows.Scan(&tagName)
		if err != nil {
			return nil, err
		}

		tags = append(tags, tagName)
	}

	return &Article{
		Title: html.EscapeString(title),
		Body:  []byte(html.EscapeString(body)),
		Id:    articleId,
		Tags:  tags,
	}, nil

}

// Handles requests for viewing a given article
func viewHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB, articleId string) {
	article, err := loadArticle(articleId, db)
	if err != nil {
		http.NotFound(writer, request)
		return
	}

	renderTemplate(writer, "view", article)
}

// Handles requests for viewing a given article
func editHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB, articleId string) {
	article, err := loadArticle(articleId, db)
	if err != nil {
		http.NotFound(writer, request)
		return
	}

	renderTemplate(writer, "edit", article)
}

func saveHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB, articleId string) {
	body := request.FormValue("body")
	title := request.FormValue("title")
	article := Article{
		Title: title,
		Body:  []byte(body),
		Id:    articleId,
	}

	if err := article.save(db); err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(writer, request, "/edit/"+articleId, http.StatusFound)
}

// Handles requests for the root path
func indexHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB) {

	articleInfo, err := getOtherArticleInformation(db)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		log.Print(err.Error())
		return
	}

	err = templates.ExecuteTemplate(writer, "index.html", articleInfo)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		log.Print(err.Error())
		return
	}
}

func newHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB) {
	article := Article{
		Title: "New Article",
		Body:  []byte(""),
		Tags:  make([]string, 0),
	}

	id, err := article.create(db)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusUnprocessableEntity)
		return
	}

	http.Redirect(writer, request, "/edit/"+strconv.FormatInt(id, 10), http.StatusFound)
}

// Creates a handler that has access to a database
func createHandler(fn func(http.ResponseWriter, *http.Request, *sql.DB), db *sql.DB) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		path := validPath.FindStringSubmatch(request.URL.Path)
		if path == nil {
			http.NotFound(writer, request)
			return
		}

		fn(writer, request, db)
	}
}

// Creates an http handler for any page related to a specific article.
// This includes editing/viewing screens
func createArticleHandler(fn func(http.ResponseWriter, *http.Request, *sql.DB, string), db *sql.DB) http.HandlerFunc {
	return func(writer http.ResponseWriter, request *http.Request) {
		path := validPath.FindStringSubmatch(request.URL.Path)
		if path == nil {
			http.NotFound(writer, request)
			return
		}

		fn(writer, request, db, strings.Split(request.URL.Path, "/")[2])
	}
}

func main() {
	db, err := sql.Open("sqlite3", "page-content.db")
	defer db.Close()
	if err != nil {
		log.Fatal("db initialization: ", err)
	}

	initScript, err := os.ReadFile("./sql/init.sql")

	_, err = db.Exec(string(initScript))
	if err != nil {
		log.Fatal("db initialization: ", err)
	}

	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/view/", createArticleHandler(viewHandler, db))
	http.HandleFunc("/new/", createHandler(newHandler, db))
	http.HandleFunc("/save/", createArticleHandler(saveHandler, db))
	http.HandleFunc("/edit/", createArticleHandler(editHandler, db))
	http.HandleFunc("/", createHandler(indexHandler, db))

	log.Print("Listening on http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}
