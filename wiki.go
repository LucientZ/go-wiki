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
var validPath = regexp.MustCompile("^/(edit|save|view)/([a-zA-Z0-9]+)$|^/$")

type Article struct {
	Title string
	Id    string
	Body  []byte
	Tags  []string
}

func (article *Article) save(db *sql.DB) error {
	articleStatement, err := db.Prepare(`
		UPDATE article
		SET title = ?, body = ?
		WHERE id = ?;
	`)
	if err != nil {
		return err
	}

	_, err = articleStatement.Exec(&article.Title, &article.Body, &article.Id)
	defer articleStatement.Close()

	return err
}

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
	if err != nil {
		return nil, err
	}
	defer articleStatement.Close()

	if err = articleStatement.QueryRow(id).Scan(&title, &body); err != nil {
		return nil, err
	}

	// Collect metadata about article
	tagStatement, err := db.Prepare(`
		SELECT tag_name FROM tag
		WHERE article_id = ?;
	`)
	if err != nil {
		return nil, err
	}
	defer tagStatement.Close()

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
	log.Print(string(article.Body))

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

	err := article.save(db)
	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}

	http.Redirect(writer, request, "/view/"+articleId, http.StatusFound)
}

// Handles requests for the root path
func indexHandler(writer http.ResponseWriter, request *http.Request, db *sql.DB) {
	err := templates.ExecuteTemplate(writer, "index.html", nil)

	if err != nil {
		http.Error(writer, err.Error(), http.StatusInternalServerError)
		return
	}
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
	if err != nil {
		log.Fatal("db initialization: ", err)
	}
	defer db.Close()

	initScript, err := os.ReadFile("./sql/init.sql")

	_, err = db.Exec(string(initScript))
	if err != nil {
		log.Fatal("db initialization: ", err)
	}

	fs := http.FileServer(http.Dir("./public"))
	http.Handle("/static/", http.StripPrefix("/static/", fs))
	http.HandleFunc("/view/", createArticleHandler(viewHandler, db))
	http.HandleFunc("/save/", createArticleHandler(saveHandler, db))
	http.HandleFunc("/edit/", createArticleHandler(editHandler, db))
	http.HandleFunc("/", createHandler(indexHandler, db))

	log.Print("Listening on http://localhost:8080")

	log.Fatal(http.ListenAndServe(":8080", nil))
}
