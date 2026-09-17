package main

import (
	"log"

	"github.com/hackutd/harp/internal/db"
	"github.com/hackutd/harp/internal/env"
	"github.com/hackutd/harp/internal/store"
)

func main() {
	addr := env.GetRequiredString("DB_ADDR")
	conn, err := db.New(addr, 25, 25, "15m")
	if err != nil {
		log.Fatal(err)
	}

	defer conn.Close()

	store := store.NewStorage(conn)

	db.Seed(store, conn)
}
