package gcs

import "context"

type Client interface {
	GenerateUploadURL(ctx context.Context, objectPath string) (string, error)
	GenerateImageUploadURL(ctx context.Context, objectPath string, contentType string) (string, error)
	GenerateDownloadURL(ctx context.Context, objectPath string) (string, error)
	DeleteObject(ctx context.Context, objectPath string) error
	GeneratePublicURL(objectPath string) string
	Close() error
}
