package repositories

import (
	"database/sql"
	"github.com/lib/pq"
	pb "github.com/virsel/sp-microservices/src/productcatalogservice/genproto"
)

type Repository interface {
	AddProduct(v *pb.Product) error
	Get(id string) (*pb.Product, error)
	GetList() ([]*pb.Product, error)
}

type ProductRepository struct {
	Db *sql.DB
}

func (repo *ProductRepository) AddProduct(v *pb.Product) error {
	// Prepare the SQL statement for inserting a product
	stmt, err := repo.Db.Prepare("INSERT INTO products (name, description, price__currency_code, price__units, price__nanos, " +
		"categories) VALUES ($1, $2, $3, $4, $5, $6)")
	if err != nil {
		return err
	}
	defer stmt.Close()

	// Execute the SQL statement to insert the product
	_, err = stmt.Exec(v.Name, v.Description, v.Price.CurrencyCode, v.Price.Units, v.Price.Nanos, pq.Array(v.Categories))

	return err
}

func (repo *ProductRepository) Get(id string) (*pb.Product, error) {
	row := repo.Db.QueryRow("SELECT * FROM products WHERE id=$1", id)
	p := pb.Product{Price: &pb.Money{}}
	err := row.Scan(&p.Id, &p.Name, &p.Description, &p.Price.CurrencyCode, &p.Price.Units, &p.Price.Nanos, pq.Array(&p.Categories))
	if err != nil {
		if err == sql.ErrNoRows {
			return nil, nil // no product found
		}
		return nil, err // some other error occurred
	}
	return &p, nil
}

func (repo *ProductRepository) GetList() ([]*pb.Product, error) {
	// Prepare the SELECT query
	query := "SELECT * FROM products"

	// Execute the query
	rows, err := repo.Db.Query(query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// Iterate over the rows and create a Product object for each one
	products := make([]*pb.Product, 0)
	for rows.Next() {
		product := pb.Product{Price: &pb.Money{}}
		err := rows.Scan(&product.Id, &product.Name, &product.Description, &product.Price.CurrencyCode, &product.Price.Units, &product.Price.Nanos,
			pq.Array(&product.Categories))
		if err != nil {
			return nil, err
		}
		products = append(products, &product)
	}

	return products, nil
}
