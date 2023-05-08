package psql

import (
	"database/sql"
	"fmt"
	"github.com/brianvoe/gofakeit/v6"
	_ "github.com/lib/pq"
	pb "github.com/virsel/sp-microservices/src/productcatalogservice/genproto"
	"github.com/virsel/sp-microservices/src/productcatalogservice/repositories"
	"github.com/virsel/sp-microservices/src/productcatalogservice/utils"
	"io/ioutil"
	"strconv"
)

func CreateConnection() (*sql.DB, error) {
	// postgres db connection vars
	host := utils.GetEnv("DB_HOST", "localhost")
	user := utils.GetEnv("DB_USER", "postgres")
	dbname := utils.GetEnv("DB_NAME", "postgres")
	password := utils.GetEnv("DB_PASSWORD", "postgres")
	port, _ := strconv.Atoi(utils.GetEnv("DB_PORT", "5432"))

	psqlInfo := fmt.Sprintf("host=%s port=%d user=%s "+"password=%s dbname=%s sslmode=disable",
		host, port, user, password, dbname)

	db, err := sql.Open("postgres", psqlInfo)
	if err != nil {
		return nil, err
	}
	return db, nil
}

func InitDb(repo *repositories.ProductRepository) error {
	// read SQL script from file
	script, err := ioutil.ReadFile("./db/schema.sql")
	if err != nil {
		return err
	}

	// execute SQL script
	_, err = repo.Db.Exec(string(script))
	if err != nil {
		return err
	}

	return insertProducts(repo)
}

func insertProducts(repo *repositories.ProductRepository) error {
	// query the count of rows in the products table
	var count int
	err := repo.Db.QueryRow("SELECT COUNT(*) FROM products").Scan(&count)
	if err != nil {
		return err
	}

	// insert entries if the products table is empty
	if count == 0 {
		var products []pb.Product
		categories := []string{"clothing", "electronics", "home goods", "food", "beauty", "toys", "sports", "outdoor", "books", "music"}
		for i := 0; i < 30; i++ {
			product := pb.Product{
				Id:          string(i),
				Name:        gofakeit.Name(),
				Description: gofakeit.Sentence(6),
				Price: &pb.Money{
					CurrencyCode: "EUR",
					Units:        int64(gofakeit.Number(4, 100)),
					Nanos:        int32(gofakeit.Number(0, 990000000)),
				},
				Categories: []string{gofakeit.RandomString(categories)},
			}
			products = append(products, product)
		}

		// insert the products into the products table
		for _, product := range products {
			repo.AddProduct(&product)
			if err != nil {
				return err
			}
		}
	}

	return err
}
