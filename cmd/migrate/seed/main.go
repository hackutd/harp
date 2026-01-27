package main

// import (
// 	"log"

// 	"github.com/hackutd/portal/internal/db"
// 	"github.com/hackutd/portal/internal/env"
// 	"github.com/hackutd/portal/internal/store"
// )

// func main() {
// 	addr := env.GetRequiredString("DB_ADDR")
// 	conn, err := db.New(addr, 3, 3, "15m")
// 	if err != nil {
// 		log.Fatal(err)
// 	}

// 	defer conn.Close()

// 	store := store.NewStorage(conn)

// 	db.Seed(store, conn)
// }