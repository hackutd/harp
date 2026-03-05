package gcs

import "context"

type Client interface {
	GenerateUploadURL(ctx context.Context, objectPath string) (string, error)
	GenerateDownloadURL(ctx context.Context, objectPath string) (string, error)
	DeleteObject(ctx context.Context, objectPath string) error
}
